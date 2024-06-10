# Hasura Turso Connector in Production
We ship the Turso connectors as Docker images.

You can look at the Dockerfile in the root of the repository to see how the image is built.

The connector can be run via a docker-compose file:

```
services:
  turso_turso:
    build:
      context: .
      dockerfile_inline: |-
        FROM ghcr.io/hasura/ndc-turso:v0.0.15
        COPY ./ /etc/connector
    develop:
      watch:
        - path: ./
          action: sync+restart
          target: /etc/connector
    env_file:
      - .env.local
    extra_hosts:
      - local.hasura.dev=host-gateway
    ports:
      - mode: ingress
        target: 8080
        published: "8085"
        protocol: tcp
```