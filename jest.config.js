// Core tests check the phone's local calendar date, so pin the time zone.
process.env.TZ = 'America/Toronto';

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
