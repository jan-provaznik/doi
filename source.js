const em = window.m;

const API_PREFIX = 'https://api.crossref.org/works/';
const API_SUFFIX = '/transform/application/x-bibtex'
const TAB_SPACES = '  ';

window.addEventListener('load', bootstrap);
function bootstrap (event) {
  em.mount(document.body, ComponentResolver);
}

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
  return text.replace(/^(@[^\{]+\{)([^,]+)/, rewriteBibHeader).replace(/\t/g, TAB_SPACES);
}

function rewriteBibHeader (match, recordType, recordName) {
  return recordType + recordName.replace(/_/g, '').toLowerCase();
}

//

class ComponentResolver {
  view () {
    return em('.resolver', [
      em('.column.control', [
        em('textarea', { 
          oninput     : this.handleTextareaInput.bind(this),
          disabled    : this.isWorking,
          placeholder : 'Enter line-separated DOI names.'
        }, this.textareaValue),
        em('button', {
          onclick     : this.handleButtonResolve.bind(this),
          disabled    : this.isWorking
        }, this.isWorking ? 'retrieving...' : 'retrieve biblatex entries'),
        this.isWorking ? em('.loading') : []
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
    this.resolvedRecords = [];
    this.requestQueue = (this.textareaValue ?? '').split('\n').filter(line => line.length);

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
        this.processQueue()
      });
  }
}

