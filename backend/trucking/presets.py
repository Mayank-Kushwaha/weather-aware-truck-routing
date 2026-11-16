"""Curated demo corridors. One end is in India for every non-US preset.

Departure times are NOT stored here: services/presets.py picks them from the live forecast so the
presets stay valid (and honest) on any day. ``kind`` is the intent; the headline shown to the user is
what the forecast actually says for the chosen window.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Place:
    label: str
    lng: float
    lat: float


@dataclass(frozen=True)
class Preset:
    id: str
    title: str
    kind: str  # "harsh" | "calm"
    region: str  # short country tag shown as a badge
    origin: Place
    destination: Place
    load_lb: int = 40_000
    interval_mi: int = 25


def _p(label: str, lng: float, lat: float) -> Place:
    return Place(label, lng, lat)


MUMBAI = _p("Mumbai, Maharashtra, India", 72.8777, 19.0760)
PUNE = _p("Pune, Maharashtra, India", 73.8567, 18.5204)
CHENNAI = _p("Chennai, Tamil Nadu, India", 80.2707, 13.0827)
PUDUCHERRY = _p("Puducherry, India", 79.8083, 11.9416)
GUWAHATI = _p("Guwahati, Assam, India", 91.7362, 26.1445)
SHILLONG = _p("Shillong, Meghalaya, India", 91.8933, 25.5788)
KOLKATA = _p("Kolkata, West Bengal, India", 88.3639, 22.5726)
BHUBANESWAR = _p("Bhubaneswar, Odisha, India", 85.8245, 20.2961)
SRINAGAR = _p("Srinagar, Jammu and Kashmir, India", 74.7973, 34.0837)
LEH = _p("Leh, Ladakh, India", 77.5771, 34.1526)
AGARTALA = _p("Agartala, Tripura, India", 91.2868, 23.8315)
VISAKHAPATNAM = _p("Visakhapatnam, Andhra Pradesh, India", 83.2185, 17.6868)
KAKINADA = _p("Kakinada, Andhra Pradesh, India", 82.2475, 16.9891)
KATHMANDU = _p("Kathmandu, Nepal", 85.3240, 27.7172)
PATNA = _p("Patna, Bihar, India", 85.1376, 25.5941)
SILIGURI = _p("Siliguri, West Bengal, India", 88.4350, 26.7271)
THIMPHU = _p("Thimphu, Bhutan", 89.6419, 27.4728)
DHAKA = _p("Dhaka, Bangladesh", 90.4125, 23.8103)
DELHI = _p("New Delhi, Delhi, India", 77.2090, 28.6139)
JAIPUR = _p("Jaipur, Rajasthan, India", 75.7873, 26.9124)
BENGALURU = _p("Bengaluru, Karnataka, India", 77.5946, 12.9716)
HYDERABAD = _p("Hyderabad, Telangana, India", 78.4867, 17.3850)
AHMEDABAD = _p("Ahmedabad, Gujarat, India", 72.5714, 23.0225)
AMRITSAR = _p("Amritsar, Punjab, India", 74.8723, 31.6340)
LAHORE = _p("Lahore, Punjab, Pakistan", 74.3587, 31.5204)
CHEYENNE = _p("Cheyenne, Wyoming, United States", -104.8202, 41.1400)
CASPER = _p("Casper, Wyoming, United States", -106.3131, 42.8666)
HOUSTON = _p("Houston, Texas, United States", -95.3698, 29.7604)
NEW_ORLEANS = _p("New Orleans, Louisiana, United States", -90.0715, 29.9511)

PRESETS: tuple[Preset, ...] = (
    Preset("mumbai-pune", "Mumbai to Pune", "harsh", "India", MUMBAI, PUNE, 35_000),
    Preset("chennai-puducherry", "Chennai to Puducherry", "harsh", "India", CHENNAI, PUDUCHERRY, 35_000),
    Preset("guwahati-shillong", "Guwahati to Shillong", "harsh", "India", GUWAHATI, SHILLONG, 30_000),
    Preset("kolkata-bhubaneswar", "Kolkata to Bhubaneswar", "harsh", "India", KOLKATA, BHUBANESWAR, 40_000),
    Preset("agartala-dhaka", "Agartala to Dhaka", "harsh", "India", AGARTALA, DHAKA, 35_000),
    Preset("visakhapatnam-kakinada", "Visakhapatnam to Kakinada", "harsh", "India", VISAKHAPATNAM, KAKINADA, 35_000),
    Preset("srinagar-leh", "Srinagar to Leh", "harsh", "India", SRINAGAR, LEH, 25_000),
    Preset("kathmandu-patna", "Kathmandu to Patna", "harsh", "Nepal", KATHMANDU, PATNA, 30_000),
    Preset("siliguri-thimphu", "Siliguri to Thimphu", "harsh", "Bhutan", SILIGURI, THIMPHU, 25_000),
    Preset("dhaka-kolkata", "Dhaka to Kolkata", "harsh", "Bangladesh", DHAKA, KOLKATA, 35_000),
    Preset("cheyenne-casper", "Cheyenne to Casper", "harsh", "USA", CHEYENNE, CASPER, 45_000),
    Preset("houston-new-orleans", "Houston to New Orleans", "harsh", "USA", HOUSTON, NEW_ORLEANS, 40_000),
    Preset("delhi-jaipur", "Delhi to Jaipur", "calm", "India", DELHI, JAIPUR, 40_000),
    Preset("bengaluru-hyderabad", "Bengaluru to Hyderabad", "calm", "India", BENGALURU, HYDERABAD, 40_000),
    Preset("ahmedabad-mumbai", "Ahmedabad to Mumbai", "calm", "India", AHMEDABAD, MUMBAI, 45_000),
    Preset("amritsar-lahore", "Amritsar to Lahore", "calm", "Pakistan", AMRITSAR, LAHORE, 30_000),
)
