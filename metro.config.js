const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const config = getDefaultConfig(__dirname);
const webAdminDir = path.resolve(__dirname, 'web-admin');

const webAdminAbsolutePattern = new RegExp(
  `^${webAdminDir
    .split(/[\\/]/)
    .map(escapeRegExp)
    .join('[\\\\/]')}([\\\\/].*)?$`
);

const existingBlockList = config.resolver?.blockList;
const normalizedBlockList = Array.isArray(existingBlockList)
  ? existingBlockList
  : existingBlockList
    ? [existingBlockList]
    : [];

config.resolver = {
  ...config.resolver,
  blockList: [...normalizedBlockList, webAdminAbsolutePattern],
};

module.exports = config;
