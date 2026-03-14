FROM node:22

WORKDIR /src

COPY package.json package-lock.json ./

RUN  npm install

COPY  . .

EXPOSE 3001

CMD [ "npm", "run" , "dev" ]