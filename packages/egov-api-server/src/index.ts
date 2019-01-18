//
// TODO this is just a quick & dirty proof of concept.
//
import { ApolloServer, gql } from 'apollo-server';

import * as egov from '@egov/data-providers';
import { DataSource } from 'apollo-datasource';

// XXX move type defs to an external file
const typeDefs = gql`
  """
  Information about a geographical location based on a postal code.
  The same postal code can belong to different places and one place can have many postal codes.
  """
  type PostalCode {
    "Postal code."
    postalCode: String!

    "Place name in one of its local languages."
    placeName: String!

    "Estimated longitude in degrees (wgs84)."
    longitude: Float!

    "Estimated latitude in degrees (wgs84)."
    latitude: Float!

    "Two-letter country identifier (ISO 3166-1 alpha-2)."
    countryCode: String!

    "Order subdivision (state)."
    adminName1: String

    "Order subdivision (state) code."
    adminCode1: String

    "Order subdivision (country/province)."
    adminName2: String

    "Order subdivision (country/province) code."
    adminCode2: String

    "Order subdivision (community)."
    adminName3: String

    "Order subdivision (community) code."
    adminCode3: String

    "Information about the radioelectric services and infrastructure present in a place."
    radioInformation: RadioInformation @cacheControl(maxAge: 60)
  }

  """
  An antenna is a physical device to transmit or receive electromagnetic (e.g. TV or radio) waves.
  """
  type Antenna {
    "A unique antenna identifier."
    id: String!

    "Human readable identifier for this antenna"
    code: String!

    "Human readable description of the antenna"
    label: String!

    "The antenna's address in human readable format."
    address: String

    "Web address to get detailed information about the antenna."
    url: String

    "Longitude in degrees (wgs84) where the antenna is located."
    longitude: Float!

    "Latitude in degrees (wgs84) where the antenna is located."
    latitude: Float!
  }

  """
  Different types of telecommunication networks.
  """
  enum NetworkType {
    "Mobile 4G in the 800MHz band."
    CELLULAR_4G_800MHZ
  }

  """
  Television signal.
  """
  type TelevisionSignal {
    "A 'multiple' is a group of TV channels broadcasted using the same frequency band."
    multiple: String!

    "Physical center that broadcasts the TV signal"
    center: String!

    "Channel frequencies. Frequencies used by a group of channels ('multiple') change in different geographical locations"
    channel: Int!
  }

  """
  Aggregated radioelectric services and infrastructure.
  """
  type RadioInformation {
    "Telecomunnication antennas"
    antennas(limit: Int = 10): [Antenna]

    "Telecomunnication networks detected. May have false negatives."
    networks: [NetworkType]

    "Television signals"
    televisionSignals: [TelevisionSignal]
  }

  "GraphQL API entry point."
  type Query {
    "Get information about geographical places that have a specific postal code."
    postalCode(postalCode: String!): [PostalCode]!
  }
`;

const resolvers = {
  Query: {
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
      const cellullar4G_800 = await networkService.isNetworkAvailable(egov.NetworkType.CELLULAR_4G_800MHZ, context.postalCode.placeName);
      return Promise.resolve(cellullar4G_800 ? [egov.NetworkType.CELLULAR_4G_800MHZ] : []);
    },
    televisionSignals: async (parent, args, context) => {
      const digitalTelevisionService = context.dataSources.digitalTelevisionService;
      return digitalTelevisionService.findTelevisionSignals(context.postalCode.placeName, context.postalCode.postalCode);
    }
  },
  PostalCode: {
    radioInformation: async (parent, args, context) => {
      context.postalCode = parent;
      return {};
    }
  }
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  dataSources: () => ({
    digitalTelevisionService: new egov.DigitalTelevisionService() as DataSource<any>,
    networkService: new egov.NetworkService() as DataSource<any>,
    antennaService: new egov.AntennaService() as DataSource<any>,
    postalCodeService: new egov.PostalCodeService() as DataSource<any>
  }),
  cacheControl: true,
  tracing: process.env.NODE_ENV === 'development',
  formatError: (error: Error) => {
    console.log(error);
    return error;
  }
});

server.listen(process.env.PORT || 4000, process.env.HOST || '0.0.0.0').then(({ url }) => {
  console.log(`GraphQL eGov API server ready at ${url}`);
});
