import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser', timeout:30000,
  reporter:[['list'],['html',{outputFolder:'playwright-report/boards',open:'never'}]],
  outputDir:'test-results/boards',
  use:{trace:'retain-on-failure',screenshot:'only-on-failure',video:'retain-on-failure'},
  projects:[
    {name:'chromium-mobile',use:{...devices['Pixel 7'],browserName:'chromium'}},
    {name:'webkit-mobile',use:{...devices['iPhone 13'],browserName:'webkit'}}
  ]
});
