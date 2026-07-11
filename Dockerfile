FROM golang:1.26.3-alpine AS build

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -tags netgo -ldflags='-s -w' -o /out/mithril-api ./cmd/api

FROM alpine:3.22

RUN apk add --no-cache ca-certificates

WORKDIR /app

COPY --from=build /out/mithril-api ./mithril-api
COPY migrations ./migrations

ENV PORT=4000
EXPOSE 4000

CMD ["sh", "-c", "./mithril-api -port \"${PORT:-4000}\" -env production -db-max-open-conns 10 -db-min-idle-conns 1"]
