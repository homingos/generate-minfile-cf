FROM node:lts-alpine

WORKDIR /app

# Google Chrome

# RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
# 	&& echo "deb http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list \
# 	&& apt-get update -qqy \
# 	&& apt-get -qqy install google-chrome-stable \
# 	&& rm /etc/apt/sources.list.d/google-chrome.list \
# 	&& rm -rf /var/lib/apt/lists/* /var/cache/apt/* \
# 	&& sed -i 's/"$HERE\/chrome"/xvfb-run "$HERE\/chrome" --no-sandbox/g' /opt/google/chrome/google-chrome

COPY . /app

RUN npm install
RUN npx puppeteer browsers install chrome
EXPOSE 3000

CMD ["npm", "start"]