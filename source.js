/* 2021 Jan Provaznik (provaznik@optics.upol.cz)
 *
 * Uses the mithril.js library.
 * Interfaces the api.crossref.org.
 */

const em = window.m;

const API_PREFIX = 'https://api.crossref.org/works/';
const API_SUFFIX = '/transform/application/x-bibtex'
const TAB_SPACES = '  ';

/* Bootstrap the interactive application. */

window.addEventListener('load', function (event) {
  em.mount(document.querySelector('.resolver'), ComponentResolver);
});

/* Interfacing the api.crossref.org */

function resolveDoi (what) {
  let path = API_PREFIX + what + API_SUFFIX;
  return window
    .fetch(path)
    .then(response => {
      return response
        .text()
        .then(content => {
          return {
            success : response.ok,
            bib : processBib(content),
            doi : what
          };
        });
    })
}

function processBib (text) {
  let next = text
    .replace(/^(@[^\{]+\{)([^,]+)/, rewriteBibHeader)
    .replace(/\t/g, TAB_SPACES);
  
  return window
    .decodeURIComponent(next);
}

function rewriteBibHeader (match, recordType, recordName) {
  return recordType + recordName.replace(/_/g, '').toLowerCase();
}

/* Application logic. */

class ComponentResolver {
  view () {
    return em('.row', [
      em('.column.control', [
        em('textarea.row', { 
          oninput     : this.handleTextareaInput.bind(this),
          disabled    : this.isWorking,
          placeholder : 'Enter line-separated DOI names.'
        }, this.textareaValue),
        em('.row', [
          em('button', {
            onclick     : this.handleButtonResolve.bind(this),
            disabled    : this.isWorking
          }, this.isWorking ? 'retrieving...' : 'retrieve biblatex entries'),
          this.isWorking ? em('.loading') : []
        ])
      ]),
      em('.column.results', [
        this.resolvedRecords.map(record => {
          if (record.success)
            return em('pre', record.bib)
          return em('pre.failed', 'Could not resolve [' + record.doi + ']');
        })
      ])
    ]);
  }

  constructor (vnode) {
    this.isWorking = false;
    this.resolvedRecords = [];
    this.requestQueue = [];
    this.textareaValue = '';
  }

  handleTextareaInput (event) {
    this.textareaValue = event.target.value;
  }

  handleButtonResolve (event) {
    this.isWorking = true;
    this.requestQueue = processLines(this.textareaValue);
    this.resolvedRecords = [];

    this.processQueue();
  }

  processQueue () {
    if (this.requestQueue.length == 0) {
      this.isWorking = false;
      em.redraw();
      return;
    }

    let what = this.requestQueue.shift();
    resolveDoi(what)
      .then(record => this.resolvedRecords.push(record))
      .catch(error => console.error(error))
      .finally(nil => {
        em.redraw();
        schedule50ms(this.processQueue.bind(this))
      });
  }
}

/* Utility. */

function processLines (blob) {
  return (blob ?? '')
    .split('\n')
    .filter(line => line.length > 0)
    .map(line => {
      let match = line.match(/doi\.org\/([^\s]+)$/);
      if (match)
        line = match[1];

      return line.trim();
    })
}

/* Rudimentary rate limiting (keeps ~ 20 requests / second). */

function schedule50ms (callback) {
  window.setTimeout(callback, 50)
}
