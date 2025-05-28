#!/bin/sh

npm install
npx prisma migrate deploy
npm run build
npm run start
