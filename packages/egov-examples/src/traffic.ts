import { TrafficRadarService } from '@egov/data-providers';

import * as readline from 'readline-sync';

(async function run() {
  const roadName = readline.question('Road name: ');

  const trafficRadarService = new TrafficRadarService();
  const allRadars = await trafficRadarService.findTrafficRadars();

  const radars = allRadars.filter(radar => radar.roadName === roadName);

  if (radars.length > 0) {
    console.log(`\nTRAFFIC RADARS ${roadName}`);
    console.table(radars, ['adminName2', 'type', 'longitude', 'latitude']);
  } else {
    console.log(`No traffic radars found with road name ${roadName}`);
  }
})();
