import * as readline from 'readline-sync';

import {
  PostalCodeService,
  AntennaService, NetworkService, NetworkType,
  DigitalTelevisionService
} from '@egov/data-providers';

run();

async function run() {
  const inputCity = readline.question('Place name: ');

  const postalCodeService = new PostalCodeService();
  const places = await postalCodeService.findByPlaceName(inputCity, 0.85);

  if (places.length === 0) {
    console.log(`Place ${inputCity} not found on geonames database.`);
    process.exit(1);
  }

  console.table(places, ['postalCode', 'placeName', 'adminCode1', 'adminCode2', 'latitude', 'longitude']);

  // Each postal code might have a differente lat/lon but geonames almost always
  // contains the same one (at least in Spain) so it is safe to use the first one.
  const city = places[0].placeName;
  const longitude = places[0].longitude;
  const latitude = places[0].latitude;

  const networkService = new NetworkService();

  const is4Gat800 = await networkService.isNetworkAvailable(NetworkType.CELLULAR_4G_800MHZ, city);
  console.log('\n4G 800MHz');
  if (is4Gat800) {
    console.log(`✅  4G (800MHz) coverage in ${city}`);
  } else {
    console.log(`❌  NO 4G (800MHz) coverage in ${city}`);
  }

  const antennaService = new AntennaService();
  const antennas = await antennaService.findAntennas(latitude, longitude);

  console.log('\nCLOSEST ANTENNAS');
  if (antennas.length === 0) {
    console.log(`No antennas found`);
  } else if (antennas.length < 10) {
    console.table(antennas, ['code', 'latitude', 'longitude']);
  } else {
    console.log(`Too many antennas found. Narrow down your search to select a smaller place.`);
  }

  const digitalTelevision = new DigitalTelevisionService();
  for (const place of places) {
    const signals = await digitalTelevision.findTelevisionSignals(city, place.postalCode);
    if (signals.length > 0) {
      console.log(`\nTV SIGNALS ${place.postalCode}`);
      console.table(signals);
    } else {
      console.log(`No TV signals found in the postal code ${place.postalCode}`);
    }
  }
}
