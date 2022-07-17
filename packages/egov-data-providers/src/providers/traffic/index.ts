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

export type TrafficVehicle = {
  numberPlate: string;
  environmentalLabel: EnvironmentalLabel;
}

export enum EnvironmentalLabel  {
  ZERO = "ZERO",
  ECO = "ECO",
  C = "C",
  B = "B",
  A = "A",
  NONE = "NONE"
}

interface ITrafficRadarService {
  findTrafficRadars(): Promise<TrafficRadar[]>;
}

interface ITrafficVehicleService {
  findByNumberPlate(numberPlate: string): Promise<TrafficVehicle>;
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

export class TrafficVehicleService implements ITrafficVehicleService {
  private BASE_URL_DGT = 'https://sede.dgt.gob.es/es/vehiculos/distintivo-ambiental';

  public async findByNumberPlate(numberPlate: string): Promise<TrafficVehicle> {

    const requester = axios.default.create({
      timeout: 5000
    });

    let response = await requester.get(this.BASE_URL_DGT, {
      params: {
        accion: "1",
        matricula: numberPlate
      }
    });

    if (response.status !== 200) {
      return Promise.reject(new Error(`Invalid response from ${this.BASE_URL_DGT}`));
    }

    if (response.data.indexOf('No se ha encontrado ningún resultado') > 0) {
      return null;
    }

    if (response.data.indexOf('Escribe la matrícula sin guiones ni espacios') > 0) {
      return null;
    }

    if (response.data.indexOf('Sin distintivo') > 0) {
      return {
        numberPlate,
        environmentalLabel: EnvironmentalLabel.NONE
      }
    }

    // Regex that extracts a whole word "A" from html code "<strong>Etiqueta Ambiental A amarilla"
    const regex = /<strong>Etiqueta Ambiental (\w)/;
    const match = regex.exec(response.data);
    if (match === null) {
      return Promise.reject(new Error(`Unexpected response from ${this.BASE_URL_DGT}`));
    } else {
      const rawEnvironmentalLabel = match[1];

      let environmentalLabel = EnvironmentalLabel.NONE;
      switch (rawEnvironmentalLabel) {
        case '0':
          environmentalLabel = EnvironmentalLabel.ZERO;
            break;
        case 'Eco':
          environmentalLabel = EnvironmentalLabel.ECO;
          break;
        case 'A':
          environmentalLabel = EnvironmentalLabel.A;
          break;
        case 'B':
          environmentalLabel = EnvironmentalLabel.B;
          break;
        case 'C':
          environmentalLabel = EnvironmentalLabel.C;
          break;
      }

      return { numberPlate, environmentalLabel };
    }
  }
}
