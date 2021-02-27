FROM node:14.16.0-alpine3.10 AS build
ENV NPM_CONFIG_LOGLEVEL warn

RUN npm i -g npm

COPY package.json package-lock.json /usr/src/app/
WORKDIR /usr/src/app/

RUN npm --loglevel=warn ci

COPY . /usr/src/app/
RUN npx tsc && npm --loglevel=warn prune --production
#
## This results in a single layer image
#FROM scratch
#COPY --from=build /usr/src/app/ /usr/src/app/
#WORKDIR /usr/src/app/
ENTRYPOINT ["node dist/index"]
CMD []
