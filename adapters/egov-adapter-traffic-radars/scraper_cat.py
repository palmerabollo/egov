import pandas as pd
import re

from datetime import datetime
from utils import timeit
from geoutils import geolocate

BASE_URL = "http://transit.gencat.cat/ca/seguretat_viaria/cinemometre_fixos_mobils_catalunya/"


def table_to_radars_mobile(table):
    radars = []

    for _, row in table.iterrows():
        # Row example:
        # ['AP-7' 'Del 159,5 al 207,4']

        radar = {
            "adminName2": "Unknown (Cataluña)",  # TODO This field is mandatory according to the graphql schema.
            "roadName": row.values[0],
            "type": "MOBILE",
            "sense": "UNKNOWN",
            # XXX review if this is semantically correct.
            #     what does "kilometers" mean in a stretch radar vs a two-sense fixed radar?
            "kilometers": map_kilometers_mobile(row.values[1]),
            "updatedAt": datetime.now().replace(microsecond=0).isoformat()  # XXX use "Data d'actualització" from the page footer.
        }

        radars.append(radar)

    return radars


def table_to_radars_stretch(table):
    # Row example:
    # ['C-16' 'Sant Cugat del Vallès' 'Vallès Occidental' 'BARCELONA']
    radars = table_to_radars_fixed(table)

    for radar in radars:
        radar["type"] = "STRETCH"

    return radars


def table_to_radars_fixed(table):
    radars = []

    for _, row in table.iterrows():
        # Row example:
        # ['N-230' 'Vilaller' 'Alta Ribagorça' 'LLEIDA']
        # It's difficult to get the sense and location from that information without using additional geoservices
        radar = {
            "adminName2": map_admin_name(row.values[3]),
            "roadName": row.values[0],
            "type": "FIXED",
            "sense": "UNKNOWN",
            "kilometers": [],
            "updatedAt": datetime.now().replace(microsecond=0).isoformat()  # XXX use "Data d'actualització" from the page footer
        }

        radars.append(radar)

    return radars


@timeit
def scrape():
    tables = pd.read_html(
        BASE_URL,
        header=0)

    if len(tables) != 3:  # fixed, mobile, stretch
        raise Exception("Unexpected data found in the source document")

    radars = []

    fixed = table_to_radars_fixed(tables[0])
    stretch = table_to_radars_stretch(tables[1])
    mobile = table_to_radars_mobile(tables[2])

    radars.extend(fixed)
    radars.extend(stretch)
    radars.extend(mobile)

    # XXX pythonize this code
    for radar in radars:
        if radar["kilometers"]:
            location = geolocate(radar["roadName"], radar["kilometers"][0])
            if location:
                radar["longitude"] = location[0]
                radar["latitude"] = location[1]

    return radars


ADMIN_NAMES={
    "BARCELONA": "Barcelona",
    "GIRONA": "Girona",
    "LLEIDA": "Lleida",
    "TARRAGONA": "Tarragona"
}

def map_admin_name(province):
    return ADMIN_NAMES.get(province)


def map_kilometers_mobile(text):
    matches = re.findall(r"(\d+,?\d?)+", text)  # XXX this RE could be more robust (e.g. two decimals)
    if len(matches) == 2:
        return [float(i.replace(',', '.')) for i in matches]
    else:
        # unexpected format
        return []
