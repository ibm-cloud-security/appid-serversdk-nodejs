/* eslint-disable max-len */
/*
 Copyright 2017 IBM Corp.
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

module.exports = {
  APPID_ALLOW_EXPIRED_TOKENS: "APPID_ALLOW_EXPIRED_TOKENS",
  ACCESS_TOKEN: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpPU0UiLCJraWQiOiJhcHBJZC1kYjhhMjdjNC1iODg3LTRmOGQtYTg5Zi1mMTJmYjc3NWIzMTEtMjAxOC0wOC0wMlQxMjowNDowOS43MjgiLCJ2ZXIiOjN9.eyJpc3MiOiJtb2JpbGVjbGllbnRhY2Nlc3Muc3RhZ2UxLm5nLmJsdWVtaXgubmV0IiwiZXhwIjoxNTUyNTEwODMxLCJhdWQiOiIyMWU4YjUyMy1lYjQyLTRhMzQtYTA1Ny0wNGNhOTQ0NWY2ZmYiLCJzdWIiOiIwZTg3NGFkMS0zMmJlLTQ1YjktYTE2YS1mYTI4YjJmMzJmY2QiLCJhbXIiOlsiZ29vZ2xlIl0sImlhdCI6MTU1MjUxMDgyOSwidGVuYW50IjoiZGI4YTI3YzQtYjg4Ny00ZjhkLWE4OWYtZjEyZmI3NzViMzExIiwic2NvcGUiOiJvcGVuaWQgYXBwaWRfZGVmYXVsdCBhcHBpZF9yZWFkcHJvZmlsZSBhcHBpZF9yZWFkdXNlcmF0dHIgYXBwaWRfd3JpdGV1c2VyYXR0ciBhcHBpZF9hdXRoZW50aWNhdGVkIn0.QFz6eP_rW30qb-X15FlbHn526BYzcQMavKOG-cvPKLDiH4VgtX-SXrTx3GSCMIgKe1iZihEkKH9OjgVOsRudv7Jvn3LMz308VVrey0H-MtA-JL5Zhn1ddH5h8rxF3XQdYl60WVmDvDjZNmRm660j4iEYewWhjdAqLgeNbw5EoRv_pqT1F8YcX-lQ_ACuhy3jL4qkB3HS282T26nWiHaRkdn0KmbsDwGIYAPEk7r8ZhAnqBEiUTS2RGczU5fA0HfoJa7utRaN7RpG4hg1MZ3a6N9WW1bhx4SFUer_eTWEf01NpzIEfdtU4F_icH17Jjlci-Qd0QbZFizQ6ueGtjyn1A",
  ACCESS_TOKEN_V4: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImFwcElkLWRiOGEyN2M0LWI4ODctNGY4ZC1hODlmLWYxMmZiNzc1YjMxMS0yMDE4LTA4LTAyVDEyOjA0OjA5LjcyOCIsInZlciI6NH0.eyJpc3MiOiJodHRwczovL2V1LWdiLmFwcGlkLnRlc3QuY2xvdWQuaWJtLmNvbS9vYXV0aC92NC9kYjhhMjdjNC1iODg3LTRmOGQtYTg5Zi1mMTJmYjc3NWIzMTEiLCJleHAiOjE1NTI1MDI0MjQsImF1ZCI6WyIyMWU4YjUyMy1lYjQyLTRhMzQtYTA1Ny0wNGNhOTQ0NWY2ZmYiXSwic3ViIjoiMGU4NzRhZDEtMzJiZS00NWI5LWExNmEtZmEyOGIyZjMyZmNkIiwiYW1yIjpbImdvb2dsZSJdLCJpYXQiOjE1NTI1MDI0MjIsInRlbmFudCI6ImRiOGEyN2M0LWI4ODctNGY4ZC1hODlmLWYxMmZiNzc1YjMxMSIsInNjb3BlIjoib3BlbmlkIGFwcGlkX2RlZmF1bHQgYXBwaWRfcmVhZHByb2ZpbGUgYXBwaWRfcmVhZHVzZXJhdHRyIGFwcGlkX3dyaXRldXNlcmF0dHIgYXBwaWRfYXV0aGVudGljYXRlZCJ9.YNkhVtNKmL9wForrm1dx3YRzzC291qzlDUKX0VZ9eP8tElec0HtZbuwhk08gyvyBWfXDkQu45kZVYS71f48xgSlKz8O5TLPgGsSZI3agWPccCqjxMcBdfvvkNKNaV3QBAo2dN7SM5K553K_JTzMPFfbaFa0farENfjRWAl7kp9zielmq7C9kkfg8mJCWQwbp5RBdXX-k79-6kNlAnbBAOhWxYM_gz9gu8pxHmfs8RSuRY972FMEEJoE5hdeICE8j1yW113O-QKUTkphFnz7sprx0_6_bvzmDXvYnPIXqGc6d_83iojBGyPXygitp8jO6gfTCTxZvNFQzRYFq1DuQqw",
  EXPIRED_ACCESS_TOKEN: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImFwcElkLWRiOGEyN2M0LWI4ODctNGY4ZC1hODlmLWYxMmZiNzc1YjMxMS0yMDE4LTA4LTAyVDEyOjA0OjA5LjcyOCIsInZlciI6NH0.eyJpc3MiOiJodHRwczovL2V1LWdiLmFwcGlkLnRlc3QuY2xvdWQuaWJtLmNvbS9vYXV0aC92NC9kYjhhMjdjNC1iODg3LTRmOGQtYTg5Zi1mMTJmYjc3NWIzMTEiLCJleHAiOjE1NTI1MDI0MjAsImF1ZCI6WyIyMWU4YjUyMy1lYjQyLTRhMzQtYTA1Ny0wNGNhOTQ0NWY2ZmYiXSwic3ViIjoiMGU4NzRhZDEtMzJiZS00NWI5LWExNmEtZmEyOGIyZjMyZmNkIiwiYW1yIjpbImdvb2dsZSJdLCJpYXQiOjE1NTI1MDI0MjIsInRlbmFudCI6ImRiOGEyN2M0LWI4ODctNGY4ZC1hODlmLWYxMmZiNzc1YjMxMSIsInNjb3BlIjoib3BlbmlkIGFwcGlkX2RlZmF1bHQgYXBwaWRfcmVhZHByb2ZpbGUgYXBwaWRfcmVhZHVzZXJhdHRyIGFwcGlkX3dyaXRldXNlcmF0dHIgYXBwaWRfYXV0aGVudGljYXRlZCJ9.JQZpZ6sOKNZ1k9stLhpECw55OniWEiqxPJYlOfpWtODwInyzs67JzTjCdTk9BYYk1NCiAFmVtKqskjL7Ud1cyFdOVnbMy4dKlnj4pzSrqmn1RihtL-ieQgalEk_6lHNU744Qm15emwzv2dVOtw7laxGYD4N_bW9CgVW8HW-q6OXBB5dkVDmZaSwP5bHkMu95K18oNKmDHNJLV4eetzXz32ssWQs2aRnMbswJwQHEwfdsQKquOsivUVfZ_8HJyO_Bb_ONQCySAKhW_29mGj7upiQ3WoiWAfLQe3E7ShdWhKK8sGoUQbDH8_GxWfUOKzNmIXjWK4hsO2RXFkdJOIYWFw",
  MALFORMED_ACCESS_TOKEN: "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJtb2JpbGVjbGllbnRhY2Nlc3Muc3RhZ2UxLm5nLmJsdWVtaXgubmV0IiwiZXhwIjoxNDg3MDg0ODc4LCJhdWQiOiIyNmNiMDEyZWIzMjdjNjEyZDkwYTY4MTkxNjNiNmJjYmQ0ODQ5Y2JiIiwiaWF0IjoxNDg3MDgxMjc4LCJhdXRoX2J5IjoiZmFjZWJvb2siLCJ0ZW5hbnQiOiI0ZGJhOTQzMC01NGU2LTRjZjItYTUxNi02ZjczZmViNzAyYmIiLCJzY29wZSI6ImFwcGlkX2RlZmF1bHQgYXBwaWRfcmVhZHByb2ZpbGUgYXBwaWRfcmVhZHVzZXJhdHRyIGFwcGlkX3dyaXRldXNlcmF0dHIifQ.HHterec250JSDY1965cM2DadBznl2wTKmzKNSnfjpdTAqax9VZvV3EwuFbEnGp9-i6AC-OlsVj7xvbALkdjwG2lZvpQx0M_gRc_3E0NiYuOGVolcm0wEXtbtDUFFqZQAf9BYYOPZ8OintdBiwUGETbH1ZRVtUvt3nalIko1OPE1Q12LvuRlhz5MClNHmvxJcXc7kucxCx4s4UFFy_HJA1gow7HWFqc9-PZf4JMWA-siYqPrdw_zYeBTBzE5co92F6JBEtGLLCjhJVz9eYgLLECXbak3z6hOaY9352Weuj7AgMOWxzw56jKKsiixMtvzrCzLVIcRUG96UJszwPHtPlA",
  MALFORMED_ACCESS_TOKEN_WITHOUTHEADER: "eyJhbGciOiJSUzI1NiIsInR5cCI6Ikp0UifQ.eyJpc3MiOiJtb2JpbGVjbGllbnRhY2Nlc3Muc3RhZ2UxLm5nLmJsdWVtaXgubmV0IiwiZXhwIjoxNDg3MDg0ODc4LCJhdWQiOiIyNmNiMDEyZWIzMjdjNjEyZDkwYTY4MTkxNjNiNmJjYmQ0ODQ5Y2JiIiwiaWF0IjoxNDg3MDgxMjc4LCJhdXRoX2J5IjoiZmFjZWJvb2siLCJ0ZW5hbnQiOiI0ZGJhOTQzMC01NGU2LTRjZjItYTUxNi02ZjczZmViNzAyYmIiLCJzY29wZSI6ImFwcGlkX2RlZmF1bHQgYXBwaWRfcmVhZHByb2ZpbGUgYXBwaWRfcmVhZHVzZXJhdHRyIGFwcGlkX3dyaXRldXNlcmF0dHIifQ.HHterec250JSDY1965cM2DadBznl2wTKmzKNSnfjpdTAqax9VZvV3EwuFbEnGp9-i6AC-OlsVj7xvbALkdjwG2lZvpQx0M_gRc_3E0NiYuOGVolcm0wEXtbtDUFFqZQAf9BYYOPZ8OintdBiwUGETbH1ZRVtUvt3nalIko1OPE1Q12LvuRlhz5MClNHmvxJcXc7kucxCx4s4UFFy_HJA1gow7HWFqc9-PZf4JMWA-siYqPrdw_zYeBTBzE5co92F6JBEtGLLCjhJVz9eYgLLECXbak3z6hOaY9352Weuj7AgMOWxzw56jKKsiixMtvzrCzLVIcRUG96UJszwPHtPlA",
  DEV_PUBLIC_KEYS: [{
    kty: "RSA",
    n: "tmHvKoPklP-f7ZmYxOjf292_VdBr110t2X9_77fgTLiSj82W8jZ-m1bZ_JbZSVVhYtyvT61RXoHY0ooH45IHStDDDh7AHo0qdX12SJMl_BfZ1TC2z7Kv8iYERqO0F0fpoHUri0SfLu9_Hp0nTR2b0T2KPub00-BWyIisFuomDSdNdJa6r2SxdtYfAfr6XKDtT1k4qwioWRfeAd_JY0RzgPhlzpzwhwvkkpugGBColWCMXHqELXuX_03x5NUU39vyx1wzBbgHb4Wa4h-FvqYQYscKcSRqT4maSdFxELAPyLsH5TMlW5sOcUrkM7oifmfMRKFNweRk-9toJ3npLv0kxQ",
    e: "AQAB",
    kid: "appId-1504675475000"
  }],
  SERVER_URL: "http://mobileclientaccess.stage1.ng.bluemix.net/",
  TENANTID: "4dba9430-54e6-4cf2-a516-6f73feb702bb",
  CLIENTID: "21e8b523-eb42-4a34-a057-04ca9445f6ff",
  BAD_CLIENTID: "111111111111111111111111111111111111",
  ISSUER: "mobileclientaccess.stage1.ng.bluemix.net",
  CONFIG_ISSUER: "https://eu-gb.appid.test.cloud.ibm.com/oauth/v4/db8a27c4-b887-4f8d-a89f-f12fb775b311",
  CONFIG_ISSUER_BLUEMIX: "https://appid-oauth.stage1.eu-gb.bluemix.net",
  TOKEN_ISSUER: "https://eu-gb.appid.test.cloud.ibm.com/oauth/v4/db8a27c4-b887-4f8d-a89f-f12fb775b311",
  CONFIG_ISSUER_NO_HTTPS: "appid-oauth.stage1.ng.bluemix.net",
  TOKEN_ISSUER_NO_HTTPS: "us-south.appid.test.cloud.ibm.com/oauth/v4/4dba9430-54e6-4cf2-a516-6f73feb702bb"
};
