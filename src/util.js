const {
  map,
  range,
  pick,
  partition,
  go,
  keys,
  zipWithIndexL,
} = require('fxjs');
const { readFile, writeFile } = require('fs/promises');

const toObj = (objectLike) => {
  const [stringKeys, numberKeys] = go(
    objectLike,
    keys,
    partition((k) => Number.isNaN(+k)),
  );

  if (stringKeys.length == 0) {
    return go(
      range(numberKeys.length),
      zipWithIndexL,
      map(([idx]) => objectLike[idx]),
    );
  }

  return pick(stringKeys, objectLike);
};

const getJSON = async (path) => JSON.parse(await readFile(path, 'utf8'));

const updateJSON = async (path, data) => writeFile(path, JSON.stringify({ ...(await getJSON(path)), ...data }));

module.exports = {
  toObj,
  getJSON,
  updateJSON,
};
