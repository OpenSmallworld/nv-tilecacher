FROM node:10.16-alpine AS base-nv-tilecacher
COPY . /
RUN rm *.json
RUN rm Dockerfile
RUN rm -Rf .git

FROM node:10.16-alpine AS nv-tilecacher
COPY --from=base-nv-tilecacher . /
CMD ["node", "tilecacher.js"]