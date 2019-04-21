import urllib
import json
import os
import functools
from utils import timeit

POINTS_URL="https://opendata.arcgis.com/datasets/d8854f26fd5c4baab08337ca0f3aff6f_0.geojson"


@timeit
def _download_kilometer_points():
    # XXX it is downloaded every time (>30 sec), we could store it somehow (S3, etc)
    # Downloading it to the repo might be an option but:
    # - we would miss updates to the dataset
    # - we would exceed the 250MB allowed per AWS Lambda function
    #
    # Such a big file (~50MB), requires around 400MB RSS memory
    file = urllib.request.urlopen(POINTS_URL)
    data = file.read().decode("utf-8")
    geofeatures = json.loads(data)["features"]

    # attempt to reduce size
    for feature in geofeatures:
        del feature["type"]
        del feature["properties"]["OBJECTID"]
        del feature["properties"]["id_porpk"]
        del feature["properties"]["id_tramo"]
        del feature["properties"]["id_vial"]
        del feature["properties"]["sentidopkD"]
        del feature["properties"]["fuente"]
        del feature["properties"]["fuenteD"]
        del feature["geometry"]["type"]
    return geofeatures

geofeatures = []

@functools.lru_cache(maxsize=64)
def _road_pks(normalizedRoadName):
    if not geofeatures:
        geofeatures = _download_kilometer_points()

    # Example
    #
    # {
    #    'type': 'Feature',
    #    'properties': {
    #        'OBJECTID': 2001,
    #        'id_porpk': 360430069577,
    #        'id_tramo': 360430002649,
    #        'id_vial': 612000060007,
    #        'numero': 2,
    #        'sentidopk': 3,
    #        'sentidopkD': 'Ambos sentidos',
    #        'fuente': 26,
    #        'fuenteD': 'DGT',
    #        'Nombre': 'EP-0208'
    #    },
    #    'geometry': {
    #        'type': 'Point',
    #        'coordinates': [-8.51971123422805, 42.35020761539828]
    #    }
    # }
    #
    pks = [{
            "number": pk["properties"]["numero"],
            "coordinates": pk["geometry"]["coordinates"],
            "sense": pk["properties"]["sentidopk"]  # 3 == both senses, 2 decreasing, 1 increasing
           }
           for pk in geofeatures if pk["properties"]["Nombre"].upper() == normalizedRoadName]

    return sorted(pks, key=lambda k: k["number"])


def geolocate(roadName, number):
    """
    Geolocates a kilometer point (number) in a given road name.
    Returns an array containing the latitude and longitude.
    """
    pks = _road_pks(normalize_road_name(roadName))
    if not pks:
        return None

    result = min(pks, key=lambda k: abs(k["number"] - number))  # closest available number
    return result["coordinates"]


ROAD_NAMES={
    "N-I": "N-1",
    "N-II": "N-2",
    "N-IIA": "N-2A",
    "N-IIE": "N-2E",
    "N-III": "N-3",
    "N-IIIA": "N-3A",
    "N-IV": "N-4",
    "N-IVA": "N-4A",
    "N-VA": "N-5A",
    "N-VI": "N-6",
    "N-121-A": "N-121A",
    "N-121-B": "N-121B",
    "N-121-C": "N-121C"
}

def normalize_road_name(roadName):
    """
    Converts the road names provided by the DGT in road names used in the IGN dataset.
    """
    # XXX  a lot of room for improvement here
    return ROAD_NAMES.get(roadName.upper(), roadName.upper())
