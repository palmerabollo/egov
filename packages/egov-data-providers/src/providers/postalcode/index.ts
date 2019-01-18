import * as path from 'path';
import * as fs from 'fs';
import * as similarity from 'string-similarity';
import * as _ from 'lodash';

export interface PostalCode {
  /**
   * ISO country code, 2 chars
   */
  countryCode: string;
  postalCode: string; // varchar(20)
  placeName: string; // varchar(180)
  /**
   * Order subdivision (state)
   */
  adminName1: string;
  adminCode1: string;
  /**
   * Order subdivision (county/province)
   */
  adminName2: string;
  adminCode2: string;
  /**
   * Order subdivision (community)
   */
  adminName3: string;
  adminCode3: string;
  /**
   * Estimated latitude (wgs84)
   */
  latitude: number;
  /**
   * Estimated longitude (wgs84)
   */
  longitude: number;
  /**
   * accuracy of lat/lng from 1=estimated to 6=centroid
   */
  accuracy: Accuracy;
}

export enum Accuracy {
  /**
   * The less precise
   */
  ESTIMATED = 1,
  /**
   * The most precise
   */
  CENTROID = 6,

  ACCURACY_1 = ESTIMATED,
  ACCURACY_2 = 2,
  ACCURACY_3 = 3,
  ACCURACY_4 = 4,
  ACCURACY_5 = 5,
  ACCURACY_6 = CENTROID
};

interface IPostalCodeService {
  /**
   * Find a specific postal code.
   * @param postalCode
   */
  findByPostalCode(postalCode: string): Promise<PostalCode[]>;

  /**
   * Find all the postal codes that belong to a specific place.
   * @param placeName Human readable place name
   * @param fuzzyness How tolerant you want to be against mispellings (1 = exact match)
   */
  findByPlaceName(placeName: string, fuzzyness: number): Promise<PostalCode[]>;
}

export class PostalCodeService implements IPostalCodeService {
  private places: PostalCode[] = [];

  constructor() {
    this.places = fs.readFileSync(path.join(__dirname, 'ES.txt')).toString()
      .split('\n')
      .filter(line => !!line)
      .map(line => {
        const attributes = line.split('\t');

        return {
          countryCode: attributes[0],
          postalCode: attributes[1],
          placeName: attributes[2],
          adminName1: attributes[3],
          adminCode1: attributes[4],
          adminName2: attributes[5],
          adminCode2: attributes[6],
          adminName3: attributes[7],
          adminCode3: attributes[8],
          latitude: Number(attributes[9]),
          longitude: Number(attributes[10]),
          // tricky typescript notation, see https://stackoverflow.com/a/42623905
          accuracy: Accuracy[`ACCURACY_${attributes[11]}` as keyof typeof Accuracy]
        };
      });
  }

  findByPostalCode(postalCode: string): Promise<PostalCode[]> {
    const result = this.places.filter(place => place.postalCode === postalCode);
    return Promise.resolve(result);
  }

  findByPlaceName(placeName: string, fuzzyness: number = 0.95): Promise<PostalCode[]> {
    const allPlaceNames = this.places
      .filter(place => place.adminCode3 !== '') // XXX Postal codes without adminCode3 are not reliable in geonames. Try to find why.
      .map(place => place.placeName);

    const capitalizedPlaceName = _.startCase(_.toLower(placeName)); // https://stackoverflow.com/a/38084493/12388
    const matches = similarity.findBestMatch(capitalizedPlaceName, allPlaceNames);

    const result = matches.bestMatch.rating >= fuzzyness
      ? this.places.filter(item => item.placeName === matches.bestMatch.target)
      : [];

    return Promise.resolve(result);
  }
}
