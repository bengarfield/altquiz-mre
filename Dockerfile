FROM node:10.16-alpine
WORKDIR /opt/mre

COPY package*.json ./
RUN ["npm", "install", "--unsafe-perm"]

COPY public ./public/

COPY tsconfig.json ./
COPY src/*.ts ./src/
RUN ["npm", "run", "build"]

EXPOSE 3901/tcp
CMD ["npm", "start"]