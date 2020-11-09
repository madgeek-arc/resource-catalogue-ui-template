// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  beta: false,
  FAQ_ENDPOINT: 'https://dl105.madgik.di.uoa.gr/faq/api',
  API_ENDPOINT: '/eic-registry', // to change the end point go to proxy.conf.json file
  API_TOKEN_ENDPOINT: '',
  projectName: '{Project Name Goes Here}',
  projectMail: 'example@mail.eu',
  serviceORresource: 'Service',
  hasUserConsent: true,
  privacyPolicyURL: '',
  marketplaceBaseURL: ''
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.
