# Service de prospection — image de production.
#
# Deux étapes : on compile dans une image Go complète, on n'expédie que le
# binaire statique dans une image minimale. Les migrations sont dans le
# binaire (embed) : rien d'autre à copier.

FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/prospection ./cmd/api

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/prospection /prospection
ENV PORT=8080
EXPOSE 8080
USER nonroot
ENTRYPOINT ["/prospection"]
