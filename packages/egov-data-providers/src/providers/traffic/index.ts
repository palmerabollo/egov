import * as axios from 'axios';

export type TrafficRadar = {
  adminName2: string;
  roadName: string;
  type: string; // XXX enum
  sense: string; // XXX enum
  kilometers: [number];
  maxSpeed?: number;
  longitude?: number;
  latitude?: number;
};

interface ITrafficRadarService {
  findTrafficRadars(): Promise<TrafficRadar[]>;
}

/**
 * Based on the egov-adapter-traffic-radars egov adapter.
 * XXX modify the URL once we expose the egov adapters under a well-known domain.
 */
export class TrafficRadarService implements ITrafficRadarService {
  private URL_ADAPTER = 'https://65uk4qchnf.execute-api.eu-west-1.amazonaws.com/dev/radars';

  public async findTrafficRadars(): Promise<TrafficRadar[]> {
    const requester = axios.default.create({
      baseURL: this.URL_ADAPTER,
      timeout: 10000 // should be much faster (<500ms) but lambda cold starts are slow sometimes
    });

    const response = await requester.request({});

    if (response.status !== 200) {
      return Promise.reject(new Error(`Invalid response from ${this.URL_ADAPTER}`));
    }

    return response.data;
  }
}
