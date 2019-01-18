import * as axios from 'axios';
import * as similarity from 'string-similarity';

export interface TelevisionSignal {
  /**
   * Un múltiple digital es el conjunto de canales de televisión que se emiten en una misma frecuencia.
   */
  multiple: string;
  /**
   * Centro transmisor de señales de televisión.
   */
  center: string;
  /**
   * Canal (frecuencias). La frecuencia del múltiple digital varía en cada zona geográfica.
   */
  channel: string;
}

interface IDigitalTelevisionService {
  findTelevisionSignals(placeName: string, postalCode: string): Promise<TelevisionSignal[]>;
}

/**
 * Based on televisiondigital.gob.es (web scraping, weak)
 */
export class DigitalTelevisionService implements IDigitalTelevisionService {
  BASE_URL_GEOPORTAL = 'http://www.televisiondigital.gob.es';

  async findTelevisionSignals(placeName: string, postalCode: string): Promise<TelevisionSignal[]> {
    const requester = axios.default.create({
      baseURL: `${this.BASE_URL_GEOPORTAL}/ayuda-ciudadano/Paginas/buscador-frecuencias.aspx`,
      timeout: 10000
    });

    let response = await requester.request({
      params: {
        cpRef: postalCode,
        cp: postalCode
      }
    });

    if (response.status !== 200) {
      return Promise.reject(new Error(`Invalid response from ${this.BASE_URL_GEOPORTAL}`));
    }

    if (response.data.indexOf('cmbPoblaciones') > 0) {
      // If a postal code belongs to different places, an intermediate screen is shown
      // with a dropdown menu to choose the place. We choose the most similar one.

      // map: place -> id
      const allPlaces = {};
      const regexPlaces = new RegExp('<option \\w*?\\s?value="(.+?)">(.+?)</option>', 'g');
      let matchesPlaces = regexPlaces.exec(response.data);

      while (matchesPlaces) {
        allPlaces[matchesPlaces[2]] = matchesPlaces[1];
        matchesPlaces = regexPlaces.exec(response.data);
      }

      const matches = similarity.findBestMatch(placeName.toUpperCase(), Object.keys(allPlaces));

      const id = allPlaces[matches.bestMatch.target];

      response = await this.findSignalsByPlaceId(id, postalCode);

      if (response.status !== 200) {
        return Promise.reject(new Error(`Invalid response from ${this.BASE_URL_GEOPORTAL}`));
      }
    }

    if (response.data.indexOf('no corresponde a ningún Código Postal') > 0) {
      // XXX think about rejecting with an Error i.e. return Promise.reject(new Error(`Postal code ${postalCode} not found`));
      return [];
    }

    // tslint:disable-next-line:max-line-length
    const regexSignals = new RegExp('<td headers="multiple-digital">(.+?)</td>\\r\\n<td headers="centro">(.+?)</td>\\r\\n<td headers="canal">(.+?)</td>', 'g');
    let matches = regexSignals.exec(response.data);

    const signals: TelevisionSignal[] = [];

    while (matches) {
      signals.push({
        multiple: matches[1],
        center: matches[2],
        channel: matches[3]
      });
      matches = regexSignals.exec(response.data);
    }

    return signals;
  }

  private async findSignalsByPlaceId(placeId: string, postalCode: string): Promise<axios.AxiosResponse<any>> {
    const requester = axios.default.create({
      baseURL: `${this.BASE_URL_GEOPORTAL}/ayuda-ciudadano/Paginas/buscador-frecuencias.aspx`,
      timeout: 10000
    });

    const response = await requester.request({
      params: {
        cpRef: postalCode,
        cp: postalCode,
        p: placeId
      }
    });

    return Promise.resolve(response);
  }
}
