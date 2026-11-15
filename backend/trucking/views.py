import logging

from django.core.cache import cache
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import AnalyzeSerializer
from .services import analyze as analysis
from .services import mapbox, openmeteo

log = logging.getLogger(__name__)


def _error(message: str, code: int) -> Response:
    return Response({"error": message}, status=code)


class HealthView(APIView):
    def get(self, request):
        return Response({"status": "ok"})


class GeocodeView(APIView):
    def get(self, request):
        q = request.query_params.get("q", "").strip()
        if len(q) < 2 or len(q) > 200:
            return Response({"results": []})
        key = f"geo:{q.lower()}"
        results = cache.get(key)
        if results is None:
            try:
                results = mapbox.geocode(q)
            except mapbox.UpstreamError as exc:
                return _error(str(exc), status.HTTP_502_BAD_GATEWAY)
            cache.set(key, results, 600)
        return Response({"results": results})


class AnalyzeView(APIView):
    def post(self, request):
        ser = AnalyzeSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        v = ser.validated_data
        req = analysis.Request(
            origin=(v["origin"]["lng"], v["origin"]["lat"]),
            destination=(v["destination"]["lng"], v["destination"]["lat"]),
            departure=v["departure"],
            load_lb=v["load_lb"],
            interval_mi=v["interval_mi"],
        )
        try:
            return Response(analysis.analyze(req))
        except mapbox.NoRouteError as exc:
            return _error(str(exc), status.HTTP_422_UNPROCESSABLE_ENTITY)
        except analysis.InputTooLarge as exc:
            return _error(str(exc), status.HTTP_400_BAD_REQUEST)
        except (mapbox.UpstreamError, openmeteo.WeatherUnavailable) as exc:
            log.warning("upstream failure: %s", exc)
            return _error(str(exc), status.HTTP_502_BAD_GATEWAY)
