import pandas as pd

from datetime import datetime
from utils import timeit
from geoutils import geolocate

BASE_URL = "https://www.trafikoa.eus/wps/portal/trafico/!ut/p/z0/04_Sj9CPykssy0xPLMnMz0vMAfIjo8ziXTycTI2CzdwsLU2cvVwNXFzdjQwgQD84tVi_INtREQACSLYJ/"


def table_to_radars(table):
    radars = []

    for _, row in table.iterrows():
        # Row example:
        # ['A-8' 111.5 'CANTABRIA' 'INICIO MALMASIN CAN' 'BASAURI' '80 km/h']
        # It's difficult to get the sense from that information without using additional geoservices
        radar = {
            "roadName": row.values[0],
            "type": "FIXED",
            "sense": "UNKNOWN",
            "kilometers": [ float(row.values[1]) ],
            "updatedAt": datetime.now().replace(microsecond=0).isoformat()
        }

        location = geolocate(radar["roadName"], radar["kilometers"][0])
        if location:
            radar["longitude"] = location[0]
            radar["latitude"] = location[1]

        try:
            radar["maxSpeed"] = int(row.values[5].split()[0])
        except ValueError:
            # some speeds appear as "60/80 km/h", we ignore those values we don't understand
            pass

        radars.append(radar)

    return radars


@timeit
def scrape():
    tables = pd.read_html(
        BASE_URL,
        header=1,
        attrs={"class": "servicio"},
        encoding="utf8")

    if len(tables) != 3:  # one table per province
        raise Exception("Unexpected data found in the source document")

    radars = []

    for index_table, table in enumerate(tables):
        radars_province = table_to_radars(table)
        for radar in radars_province:
            radar["adminName2"] = map_admin_name(index_table)

        radars.extend(radars_province)

    return radars


def map_admin_name(table_index):
    # uses names from geonames for consistency with other egov apis
    if table_index == 0:
        return "Vizcaya"
    elif table_index == 1:
        return "Álava"
    elif table_index == 2:
        return "Guipúzcoa"
    else:
        return None
