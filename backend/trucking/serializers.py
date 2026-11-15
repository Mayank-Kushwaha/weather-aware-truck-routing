from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from .domain.geometry import haversine_m

MAX_LOAD_LB = 80_000  # US federal gross vehicle weight limit; cargo cannot exceed it
MAX_DEPARTURE_DAYS = 14  # keeps the ETA and the 48 h heatmap window inside the 16-day forecast
INTERVALS = (10, 25, 50)


class PointSerializer(serializers.Serializer):
    lat = serializers.FloatField(min_value=-90, max_value=90)
    lng = serializers.FloatField(min_value=-180, max_value=180)
    label = serializers.CharField(required=False, allow_blank=True, max_length=300)


class AnalyzeSerializer(serializers.Serializer):
    origin = PointSerializer()
    destination = PointSerializer()
    departure = serializers.DateTimeField()
    load_lb = serializers.IntegerField(min_value=0, max_value=MAX_LOAD_LB)
    interval_mi = serializers.ChoiceField(choices=INTERVALS, default=25)

    def validate_interval_mi(self, value):
        return int(value)

    def validate_departure(self, value):
        now = timezone.now()
        if value < now - timedelta(hours=1):
            raise serializers.ValidationError("Departure cannot be in the past.")
        if value > now + timedelta(days=MAX_DEPARTURE_DAYS):
            raise serializers.ValidationError(f"Departure must be within {MAX_DEPARTURE_DAYS} days (forecast range).")
        return value

    def validate(self, attrs):
        o, d = attrs["origin"], attrs["destination"]
        if haversine_m((o["lng"], o["lat"]), (d["lng"], d["lat"])) < 1000:
            raise serializers.ValidationError("Origin and destination are too close together.")
        return attrs
