# Collecteur — image pour une exécution planifiée (Railway cron, ou à la main).
#
# Pas de serveur : le conteneur lance une collecte et s'arrête. Les variables
# PLACES_API_KEY, PROSPECTION_API_URL et COLLECTOR_TOKEN viennent de l'hébergeur.

FROM python:3.11-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY pyproject.toml ./
COPY collector ./collector
RUN pip install --no-cache-dir .
USER nobody
ENTRYPOINT ["plugin-collect"]
CMD ["run"]
