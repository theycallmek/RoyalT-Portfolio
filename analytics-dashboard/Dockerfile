# syntax=docker/dockerfile:1
# Private GoatCounter dashboard: https://github.com/abhishekhsingh/goatcounter-dashboard (MIT), pinned
# to a reviewed commit. Its CDN scripts are fetched at build time with checksums and served locally,
# so no third-party code runs next to the API key. To update: bump the URLs, re-review index.html,
# and replace each checksum with the new file's sha256.
FROM caddy:2-alpine
ARG GCD=https://raw.githubusercontent.com/abhishekhsingh/goatcounter-dashboard/49b7fd2789c8228380e157336fc32c55f952341d
ADD --checksum=sha256:2f0b104a832ed86c23ee9fa9302bb22794a410c85f0e84ab568845adf2a678c1 ${GCD}/index.html /srv/index.html
ADD --checksum=sha256:eafbdcf763cd665f8978abcdbf96ac9427e9f78c7cd7fea8867eb47065844481 ${GCD}/assets/world-map.js /srv/assets/world-map.js
ADD --checksum=sha256:fd0594ca75cd2ae875c6839f89378f3883a89f585f499291e52bc08cf7fd3a2e ${GCD}/LICENSE /srv/LICENSE.txt
ADD --checksum=sha256:d949f1c3687aedadcedac85261865f29b17cd273997e7f6b2bfc53b2f9d4c4dd https://unpkg.com/react@18.3.1/umd/react.production.min.js /srv/vendor/
ADD --checksum=sha256:35f4f974f4b2bcd44da73963347f8952e341f83909e4498227d4e26b98f66f0d https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js /srv/vendor/
ADD --checksum=sha256:e653471aba824786aee5dce1bcb5a86ed30c8518d346d2ace0460a5633a9cbdb https://unpkg.com/prop-types@15.8.1/prop-types.min.js /srv/vendor/
ADD --checksum=sha256:7eaf8c65bba4d3b6847bd00011c359605b528b5cb12e13fce09180bfa7bd456f https://unpkg.com/recharts@2.15.4/umd/Recharts.js /srv/vendor/
ADD --checksum=sha256:8d71ef5e84061e89a257df4f723b6a51526f9f8db4a0321af146b6a6d46ebd57 https://unpkg.com/@babel/standalone@7.29.3/babel.min.js /srv/vendor/
# Point the CDN script tags at the local copies and drop Google Fonts (system fonts are used instead).
RUN sed -i -E 's#https://unpkg\.com/[^"]*/([^/"]+\.js)"#/vendor/\1"#; /fonts\.(googleapis|gstatic)\.com/d' /srv/index.html \
 && ! grep -qE 'unpkg\.com|fonts\.g' /srv/index.html \
 && chmod -R a+rX /srv
COPY Caddyfile /etc/caddy/Caddyfile
