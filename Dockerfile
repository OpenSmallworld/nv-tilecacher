# Build the dockerfile using this command:
# docker build --build-arg HTTPS_PROXY=http://emea.proxy.ge.com -t dtr.predix.io/pwr-smallworld/tilecacher:SW521 .
FROM node:10.16-alpine AS base-nv-tilecacher
RUN mkdir /tilecacher
COPY . /tilecacher
RUN rm -Rf /tilecacher/example_config_files
RUN rm /tilecacher/Dockerfile
RUN rm /tilecacher/.gitignore
RUN rm -Rf /tilecacher/.git

FROM node:10.16-alpine AS nv-tilecacher
COPY --from=base-nv-tilecacher . /
WORKDIR /tilecacher
RUN npm install
RUN npm install follow-redirects
CMD ["node", "/tilecacher/tilecacher.js", "-d", "/tilecacher/config"]
