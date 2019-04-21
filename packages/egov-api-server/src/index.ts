//
// This is still a quick proof of concept.
// Contributions and ideas to help organize it are welcome.
//
import * as egov from '@egov/data-providers';
import * as fs from 'fs';
import * as logops from 'logops';
import * as path from 'path';

import { FastRateLimit } from 'fast-ratelimit';

import { DataSource } from 'apollo-datasource';
import { ApolloError, ApolloServer, gql } from 'apollo-server';
import { GraphQLFormattedError } from 'graphql';

// XXX use a schema validator at lint time https://github.com/cjoudrey/graphql-schema-linter
const schema = fs.readFileSync(path.join(__dirname, 'schema.graphql')).toString();
const typeDefs = gql(schema);

const resolvers = {
  PointOfInterest: {
    __resolveType(obj, context, info) {
        // the only supported POI is TrafficRadar for now.
        // see https://www.apollographql.com/docs/apollo-server/features/unions-interfaces#union-type
        //     https://medium.com/the-graphqlhub/graphql-tour-interfaces-and-unions-7dd5be35de0d
        return 'TrafficRadar';
    }
  },
  PostalCode: {
    radioInformation: async (parent, args, context) => {
      context.postalCode = parent;
      return {};
    }
  },
  Query: {
    poi: async (parent, args, context) => {
      const trafficRadars = context.dataSources.trafficRadarService.findTrafficRadars();
      return trafficRadars;
    },
    postalCode: async (parent, args, context) => {
      const postalCodeService = context.dataSources.postalCodeService;
      return await postalCodeService.findByPostalCode(args.postalCode);
    }
  },
  RadioInformation: {
    antennas: async (parent, args, context) => {
      const antennaService = context.dataSources.antennaService;
      const antennas = await antennaService.findAntennas(context.postalCode.latitude, context.postalCode.longitude);
      return Promise.resolve(antennas.slice(0, args.limit));
    },
    networks: async (parent, args, context) => {
      const networkService = context.dataSources.networkService;
      const cellullar4G800 = await networkService.isNetworkAvailable(egov.NetworkType.CELLULAR_4G_800MHZ, context.postalCode.placeName);
      return Promise.resolve(cellullar4G800 ? [egov.NetworkType.CELLULAR_4G_800MHZ] : []);
    },
    televisionSignals: async (parent, args, context) => {
      const digitalTelevisionService = context.dataSources.digitalTelevisionService;
      return digitalTelevisionService.findTelevisionSignals(context.postalCode.placeName, context.postalCode.postalCode);
    }
  }
};

// threshold defines the available tokens over timespan (ttl)
const rateLimiter = new FastRateLimit({
  threshold: 10,
  ttl: 60
});

const server = new ApolloServer({
  cacheControl: true,
  context: async ({ req }) => {
    const token = req.headers.authorization; // TODO use JWT tokens
    try {
      if (req.ip !== '127.0.0.1') {
        await rateLimiter.consume(req.ip);
      }
      return { token };
    } catch (e) {
      logops.debug('Rate limit', req.ip);
      throw new ApolloError('Rate limit (10 req/min). Please wait. Request an API key to increase this limit.', 'TOO_MANY_REQUESTS');
    }
  },
  dataSources: () => ({
    antennaService: new egov.AntennaService() as DataSource<any>,
    digitalTelevisionService: new egov.DigitalTelevisionService() as DataSource<any>,
    networkService: new egov.NetworkService() as DataSource<any>,
    postalCodeService: new egov.PostalCodeService() as DataSource<any>,
    trafficRadarService: new egov.TrafficRadarService() as DataSource<any>
  }),
  formatError: error => {
    if (error.extensions.code === 'TOO_MANY_REQUESTS') {
      return { message: error.message } as GraphQLFormattedError;
    } else {
      logops.warn(error);
      return { message: 'Internal Server Error. Report it to help us fix the issue.' } as GraphQLFormattedError;
    }
  },
  resolvers,
  tracing: process.env.NODE_ENV === 'development',
  typeDefs
});

server.listen(process.env.PORT || 4000, process.env.HOST || '0.0.0.0').then(({ url }) => {
  logops.debug(`GraphQL eGov API server ready at ${url}`);
});
