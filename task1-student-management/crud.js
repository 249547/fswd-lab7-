const express = require('express');
const { db, nextId } = require('./store');

/*
  makeCrud builds the 5 standard routes for one module:
    POST   /        create
    GET    /        read all (with optional ?field=value filters)
    GET    /:id     read one
    PUT    /:id     update (full replace)
    PATCH  /:id     update (only the sent fields)
    DELETE /:id     delete

  config = {
    name:      key inside db (e.g. 'students')
    fields:    all allowed fields
    required:  fields that must be present on create / PUT
    validate:  (data) => error string or null   (extra checks)
    onDelete:  (item) => void                   (cleanup after delete)
  }
*/
function makeCrud(config) {
  const router = express.Router();
  const list = () => db[config.name];

  const pick = (body) => {
    const out = {};
    for (const f of config.fields) if (body[f] !== undefined) out[f] = body[f];
    return out;
  };

  const missing = (data) => config.required.filter((f) => data[f] === undefined || data[f] === '');

  // CREATE
  router.post('/', (req, res) => {
    const data = pick(req.body);
    const miss = missing(data);
    if (miss.length) return res.status(400).json({ error: `Missing field(s): ${miss.join(', ')}` });
    const err = config.validate && config.validate(data, null);
    if (err) return res.status(400).json({ error: err });

    const item = { id: nextId[config.name]++, ...data };
    list().push(item);
    res.status(201).json(item);
  });

  // READ ALL (+ simple filtering, e.g. /marks?studentId=1&subject=OS)
  router.get('/', (req, res) => {
    let items = list();
    for (const [key, value] of Object.entries(req.query)) {
      if (config.fields.includes(key)) items = items.filter((i) => String(i[key]).toLowerCase() === String(value).toLowerCase());
    }
    res.json({ count: items.length, data: items });
  });

  // READ ONE
  router.get('/:id', (req, res) => {
    const item = list().find((i) => i.id === Number(req.params.id));
    if (!item) return res.status(404).json({ error: `${config.name} record not found` });
    res.json(item);
  });

  // UPDATE (PUT = replace everything, PATCH = change some fields)
  const update = (full) => (req, res) => {
    const item = list().find((i) => i.id === Number(req.params.id));
    if (!item) return res.status(404).json({ error: `${config.name} record not found` });

    const data = pick(req.body);
    const merged = full ? data : { ...item, ...data };
    delete merged.id;
    const miss = missing(merged);
    if (miss.length) return res.status(400).json({ error: `Missing field(s): ${miss.join(', ')}` });
    const err = config.validate && config.validate(merged, item);
    if (err) return res.status(400).json({ error: err });

    Object.keys(item).forEach((k) => k !== 'id' && delete item[k]);
    Object.assign(item, merged);
    res.json(item);
  };
  router.put('/:id', update(true));
  router.patch('/:id', update(false));

  // DELETE
  router.delete('/:id', (req, res) => {
    const index = list().findIndex((i) => i.id === Number(req.params.id));
    if (index === -1) return res.status(404).json({ error: `${config.name} record not found` });
    const [removed] = list().splice(index, 1);
    if (config.onDelete) config.onDelete(removed);
    res.json({ message: 'Deleted', deleted: removed });
  });

  return router;
}

module.exports = makeCrud;
