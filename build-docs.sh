#!/bin/bash

git reset --hard
git pull origin master
chattr -i /www/wwwroot/localesail-for-vue-i18n/dist/.user.ini
npm install && npm run docs:build
