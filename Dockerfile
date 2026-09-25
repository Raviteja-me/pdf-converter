FROM node:18-slim

# Install Chrome, plus the fonts a document is allowed to ask for.
#
# The container previously shipped Chromium and nothing else, so every generated
# PDF fell back to whatever Debian's default sans happened to be. That is the
# main reason the output looked dated regardless of the CSS. The set below is
# deliberate:
#   liberation / crosextra  - metric-compatible with Arial, Times, Calibri and
#                             Cambria, so a document naming any of those gets
#                             the right proportions rather than a substitution
#                             that reflows it.
#   lato, eb-garamond       - a humanist sans and a book serif, for designs that
#                             want to look typeset rather than generic.
#   dejavu                  - broad symbol coverage.
#   noto core / cjk / emoji - names and addresses in Devanagari, Tamil, Arabic,
#                             Chinese and so on. Without these a candidate whose
#                             own name is not in Latin script gets a row of
#                             empty boxes on their resume, which is the worst
#                             failure this service can produce.
RUN apt-get update && apt-get install -y \
    chromium \
    fontconfig \
    fonts-liberation \
    fonts-crosextra-carlito \
    fonts-crosextra-caladea \
    fonts-lato \
    fonts-ebgaramond \
    fonts-dejavu-core \
    fonts-noto-core \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    --no-install-recommends \
    && fc-cache -f \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8080
CMD [ "node", "index.js" ]