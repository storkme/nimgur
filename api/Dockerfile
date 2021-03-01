FROM node:14.16.0-alpine3.10 AS build
ENV NPM_CONFIG_LOGLEVEL warn

RUN npm i -g npm

COPY package.json package-lock.json /usr/src/app/
WORKDIR /usr/src/app/

RUN npm --loglevel=warn ci

COPY . /usr/src/app/
RUN npm --loglevel=warn test
RUN npx tsc
RUN npm --loglevel=warn prune --production

CMD ["npm", "start"]
EXPOSE 8041
