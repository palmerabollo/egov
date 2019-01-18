import * as axios from 'axios';
import * as iconv from 'iconv-lite';
import * as similarity from 'string-similarity';

export interface Antenna {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  type: string;
  code: string;
  address: string;
  url: string;
}

export enum NetworkType {
  CELLULAR_4G_800MHZ = 'CELLULAR_4G_800MHZ'
}

interface IAntennaService {
  findAntennas(latitude: number, longitude: number, radius: number): Promise<Antenna[]>;
}

interface INetworkService {
  isNetworkAvailable(type: NetworkType, placeName: string, fuzzyness: number): Promise<boolean>;
}

/**
 * Implementation based on the Minetur GeoPortal (undocumented API)
 */
export class AntennaService implements IAntennaService {
  BASE_URL_GEOPORTAL = 'https://geoportal.minetur.gob.es/VCTEL';

  async findAntennas(latitude: number, longitude: number, radius: number = 0.05): Promise<Antenna[]> {
    const requester = axios.default.create({
      baseURL: `${this.BASE_URL_GEOPORTAL}/infoantenasGeoJSON.do`,
      timeout: 10000,
      method: 'get',
      responseType: 'arraybuffer'
    });

    requester.interceptors.response.use(response => {
      const ctype = response.headers['content-type'];
      if (ctype.includes('charset=ISO-8859-1')) {
        response.data = iconv.decode(response.data, 'ISO-8859-1');
      }

      response.data = JSON.parse(response.data);
      return response;
    });

    // format: lon,lat,lon,lat
    const bbox = `${Number(longitude) - radius},${Number(latitude) - radius},${Number(longitude) + radius},${Number(latitude) + radius}`;

    let response = await requester.request({
      params: {
        bbox: bbox,
        zoom: 4 // min value to get results from this service
      }
    });

    if (response.status !== 200) {
      return Promise.reject(new Error(`Invalid response from ${this.BASE_URL_GEOPORTAL}`));
    }

    const antennaFeatures: any[] = response.data.features;
    if (antennaFeatures) {
      const antennas: Antenna[] = antennaFeatures.map(antenna => {
        return {
          id: antenna.properties.Gis_ID,
          latitude: Number(antenna.properties.Gis_Latitud),
          longitude: Number(antenna.properties.Gis_Longitud),
          code: antenna.properties.Gis_Codigo,
          label: antenna.properties.Gis_Etiqueta,
          type: antenna.properties.Tipo,
          address: antenna.properties.Dirección,
          url: antenna.properties.Detalle.replace('@@<url-aplicacion>', this.BASE_URL_GEOPORTAL)
        };
      });

      return Promise.resolve(antennas);
    } else {
      return Promise.resolve([]);
    }
  }
}

/**
 * Implementation based on the Llega800 site (undocummented API).
 * See https://www.llega800.es
 */
export class NetworkService implements INetworkService {
  BASE_URL_4G_800 = 'https://www.llega800.es';

  async isNetworkAvailable(type: NetworkType, placeName: string, fuzzyness: number = 0.95): Promise<boolean> {
    if (type !== NetworkType.CELLULAR_4G_800MHZ) {
      // Other network types are not implemented yet
      return false;
    }

    const requester = axios.default.create({
        baseURL: `${this.BASE_URL_4G_800}/extraemunicipios_todos.php`,
        timeout: 5000,
        method: 'get'
    });

    const response = await requester.request({});

    if (response.status !== 200) {
      return Promise.reject(new Error(`Invalid response from ${this.BASE_URL_4G_800}`));
    }

    // e.g. {"Municipio":"ALCAZAR DEL REY, CUENCA"} => "ALCAZAR DEL REY"
    // XXX This can fail if there are two places with the same name in different provinces.
    const allPlaces = response.data.map(item => item.Municipio.substring(0, item.Municipio.indexOf(',')));

    const match4G800 = similarity.findBestMatch(placeName.toUpperCase(), allPlaces);
    return Promise.resolve(match4G800.bestMatch.rating > fuzzyness);
  }
}
