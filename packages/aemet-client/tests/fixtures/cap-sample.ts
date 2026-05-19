export const CAP_SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>2.49.0.0.724.0.20260517081500</identifier>
  <sender>aemet@aemet.es</sender>
  <sent>2026-05-17T08:15:00+02:00</sent>
  <status>Actual</status>
  <msgType>Alert</msgType>
  <scope>Public</scope>
  <code>AEMET-Meteoalerta</code>
  <info>
    <language>es-ES</language>
    <category>Met</category>
    <event>Tormentas</event>
    <responseType>Monitor</responseType>
    <urgency>Future</urgency>
    <severity>Moderate</severity>
    <certainty>Likely</certainty>
    <effective>2026-05-17T12:00:00+02:00</effective>
    <onset>2026-05-17T12:00:00+02:00</onset>
    <expires>2026-05-17T20:00:00+02:00</expires>
    <senderName>AEMET</senderName>
    <headline>Aviso amarillo por tormentas en interior de Madrid</headline>
    <description>Tormentas con granizo posible.</description>
    <instruction>Precaucion.</instruction>
    <parameter>
      <valueName>AEMET-Meteoalerta nivel</valueName>
      <value>amarillo</value>
    </parameter>
    <parameter>
      <valueName>AEMET-Meteoalerta fenomeno</valueName>
      <value>TO</value>
    </parameter>
    <area>
      <areaDesc>Madrid - Henares</areaDesc>
      <polygon>40.5,-3.5 40.6,-3.4 40.7,-3.3 40.5,-3.5</polygon>
      <geocode>
        <valueName>AEMET-Meteoalerta zona</valueName>
        <value>761201</value>
      </geocode>
    </area>
  </info>
  <info>
    <language>en-GB</language>
    <category>Met</category>
    <event>Thunderstorms</event>
    <responseType>Monitor</responseType>
    <urgency>Future</urgency>
    <severity>Moderate</severity>
    <certainty>Likely</certainty>
    <effective>2026-05-17T12:00:00+02:00</effective>
    <senderName>AEMET</senderName>
    <headline>Yellow warning for thunderstorms in inland Madrid</headline>
    <description>Thunderstorms with possible hail.</description>
    <parameter>
      <valueName>AEMET-Meteoalerta nivel</valueName>
      <value>yellow</value>
    </parameter>
    <area>
      <areaDesc>Madrid - Henares</areaDesc>
      <polygon>40.5,-3.5 40.6,-3.4 40.7,-3.3 40.5,-3.5</polygon>
      <geocode>
        <valueName>AEMET-Meteoalerta zona</valueName>
        <value>761201</value>
      </geocode>
    </area>
  </info>
</alert>`;
