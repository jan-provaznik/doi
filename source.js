/* 2021 - 2022 Jan Provaznik (jan@provaznik.pro)
 *
 * Roses are red
 * Violets are blue
 * If bibliography makes you sad
 * This might help you
 *
 * Version 1.4-0
 *
 */

const em = window.m;

const API_PREFIX = 'https://doi.org/';
const TAB_SPACES = '  ';

//

const TEX = createMappingTeX()

function toTeX (value) {
  return Array.from(value).map(letter => {
    let code = letter.charCodeAt();
    if (TEX.has(code)) {
      return TEX.get(code);
    }
    else {
      return letter;
    }
  }).join('')
}

// Bootstrap the interactive application.
//

window.addEventListener('load', function (event) {
  em.mount(document.querySelector('.resolver'), ComponentResolver);
});

// Per https://stackoverflow.com/a/37511463 we remove accents and other
// stuff from names.
//

function toAscii (value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Interfacing https://doi.org
//

function resolveDoi (what) {
  let path = API_PREFIX + what;
  return window
    .fetch(path, {
      headers: { 
        'accept' : 'application/vnd.citationstyles.csl+json' 
      } 
    })
    .then(response => {
      return response
        .text()
        .then(content => {
          let csl = JSON.parse(content);

          return {
            success : response.ok,
            bib : createBib(csl),
            doi : what
          };
        })
        .catch(error => {
          console.error(error);

          return {
            success : false,
            bib : null,
            doi : what
          };
        })
    });
}

// CSL https://docs.citationstyles.org/en/stable/specification.html
// implementation.
//

function cslDate (csl) {
  for (let key of [ 'issued', 'created' ]) {
    try {
      let value = _cslDate(csl, key);
      if (value.year) {
        return value;
      }
    }
    catch {
    }
  }

  return {
    year : 9999
  };

}

function _cslDate (csl, key) {
  let parts = csl[key]['date-parts'][0];

  if (parts.length == 3) {
      return {
        year  : parts[0],
        month : parts[1],
        day   : parts[2]
      };
  }

  if (parts.length > 0) {
    return {
      year : parts[0]
    };
  }
}

function cslAuthors (csl) {
  let authors = csl['author'];
  return authors.map(author => {
    return {
      sname : author.family,
      gname : author.given
    };
  });
}

function cslTitle (csl) {
  return csl['title'];
}

function cslJournalTitle (csl) {
  return csl['container-title'];
}

function cslJournalIssue (csl) {
  return csl['issue'];
}

function cslJournalVolume (csl) {
  return csl['volume'];
}

function cslJournalPage (csl) {
  return csl['page'];
}

function cslJournalPublisher (csl) {
  return csl['publisher'];
}

function cslURL (csl) {
  return csl['URL'];
}

function cslDOI (csl) {
  return csl['DOI'];
}

// BibTeX https://ctan.org/pkg/biblatex?lang=en
// generator implementation.
//

function createBibRecord (key, val) {
  return {
    key: key,
    val: val
  };
}

function createBibTitle (csl) {
  return createBibRecord('title', toTeX(cslTitle(csl)));
}

function createBibAuthor (csl) {
  let d = cslAuthors(csl)
    .map(each => {
      return (toTeX(each.sname) + ', ' + toTeX(each.gname));
    })
    .join(' and ');
  return createBibRecord('author', d);
}

function createBibDate (csl) {
  const d = cslDate(csl);
  const f = []

  if (d.year) {
    f.push(createBibRecord('year', d.year));
  }
  if (d.month) {
    f.push(createBibRecord('month', d.month));
  }
  if (d.day) {
    f.push(createBibRecord('day', d.day));
  }

  return f;
}

// 

function createBibJournal (csl) {
  return createBibRecord('journal', cslJournalTitle(csl));
}

function createBibNumber (csl) {
  return createBibRecord('number', cslJournalIssue(csl));
}

function createBibVolume (csl) {
  return createBibRecord('volume', cslJournalVolume(csl));
}

function createBibPages (csl) {
  return createBibRecord('pages', cslJournalPage(csl));
}

function createBibPublisher (csl) {
  return createBibRecord('publisher', cslJournalPublisher(csl));
}

function createBibURL (csl) {
  return createBibRecord('url', cslURL(csl));
}

function createBibDOI (csl) {
  return createBibRecord('doi', cslDOI(csl));
}

function createBib (csl) {
  let F = []

  F.push(createBibTitle(csl));
  F.push(createBibAuthor(csl));

  F.push(... createBibDate(csl));

  F.push(createBibNumber(csl));
  F.push(createBibVolume(csl));
  F.push(createBibJournal(csl));
  F.push(createBibPages(csl));
  F.push(createBibPublisher(csl));

  F.push(createBibURL(csl));
  F.push(createBibDOI(csl));

  // 

  let bibLabelType = createBibLabelType(csl);
  let bibLabelName = createBibLabelName(csl);
  let bibBody = F
    .filter(record => record.val)
    .map(record => {
      return ('  ' + record.key + ' = {' + record.val + '}');
    })
    .join(', \n');

  //

  return ('@' + bibLabelType + '{' + bibLabelName + ',\n' + bibBody + '\n' + '}')
}

function createBibLabelName (csl) {
  let labelAuthor = toAscii(cslAuthors(csl)[0].sname)
    .toLowerCase()
    .replace(/\W/, '');
  let labelYear = cslDate(csl).year;

  return labelAuthor + labelYear;
}

function createBibLabelType(csl) {

  if (csl.type.match(/proceedings-/)) {
    return 'inproceedings';
  }

  if (csl.type.match(/journal-|article/)) {
    return 'article';
  }

  return 'misc';
}

// Application logic.
//

class ComponentResolver {

  viewControls () {
    return em('.column.control', [
      em('textarea.row', { 
        oninput     : this.handleTextareaInput.bind(this),
        disabled    : this.isWorking,
        placeholder : 'Enter line-separated DOI names.'
      }, this.textareaValue),
      em('.row.apart', [
        em('button', {
          onclick     : this.handleButtonResolve.bind(this),
          disabled    : this.isWorking
        }, this.isWorking ? 'retrieving...' : 'retrieve biblatex entries'),
        this.isWorking ? em('.loading') : []
      ])
    ]);
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

  viewResults () {
    return em('.column.results', [
      this.viewResultsButtons(),
      this.resolvedRecords.map(record => {
        if (record.success) {
          return em('pre', record.bib)
        }

        return em('pre.failed', 'Could not resolve [' + record.doi + ']');
      })
    ]);
  }

  viewResultsButtons () {
    let disable = this.isWorking || !this.resolvedRecords.filter(record => record.success).length;
    return em('.buttons.row.together', [
      em('button', {
        onclick   : this.handleButtonClipboard.bind(this),
        disabled  : disable
      }, 'Copy to clipboard'),
      em('button', {
        onclick   : this.handleButtonWindow.bind(this),
        disabled  : disable
      }, 'Open in new window'),
      em('button.highlight', {
        onclick   : this.handleButtonDownload.bind(this),
        disabled  : disable
      }, 'Download database')
    ]);
  }

  handleButtonClipboard () {
    let text = this.createRecordsText();
    navigator.clipboard.writeText(text);
  }

  handleButtonWindow () {
    let url = this.createRecordsURL();
    let win = window.open(url, '_blank');

    let timer = window.setInterval(nil => {
      if (win.closed) {
        URL.revokeObjectURL(url);
        window.clearInterval(timer);

        console.log('handleButtonWindow housekeeping: freed URL')
      }
    }, 1000);
  }

  handleButtonDownload () {
    let url = this.createRecordsURL();
    let elm = document.createElement('a');

    elm.style.display = 'none';
    elm.download = 'db.bib';
    elm.href = url;

    document.body.appendChild(elm)
    elm.click();

    window.setTimeout(nil => {
      URL.revokeObjectURL(url);
      document.body.removeChild(elm);

      console.log('handleButtonDownload housekeeping: freed URL')
    }, 1000);

  }

  view () {
    return [
      this.viewControls(),
      this.viewResults(),
    ];
  }

  constructor (vnode) {
    this.isWorking = false;
    this.resolvedRecords = [];
    this.requestQueue = [];
    this.textareaValue = '';
  }

  /* Record retrieval. */

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

  /* Record serialization. */

  createRecordsText () {
    return this.resolvedRecords
      .filter(record => record.success)
      .map(record => record.bib)
      .join('\n\n');
  }

  createRecordsBlob () {
    return new Blob([ this.createRecordsText() ], { type : 'text/plain' });
  }

  createRecordsURL () {
    return URL.createObjectURL(this.createRecordsBlob());
  }

}

// Utility.
//

function processLines (blob) {
  let list = (blob ?? '')
    .split('\n')
    .reduce(processLine, [])
    .map(each => each.toLowerCase());
  return [ ... new Set(list) ];
}

// Every DOI starts with the following prefix: '10.' followed by at least 4
// digits which may be followed by additional dots and digits. A slash '/' then
// separated the prefix from the suffix which may contain essentially enything,
// including spaces, use of which is, however, discouraged.
//
// https://www.medra.org/en/DOI.htm
// https://en.wikipedia.org/wiki/Digital_object_identifier

function processLine (list, line) {

  let urlMatches = line.matchAll(/doi\.org\/([^\s\}]+)/ig);
  let doiMatches = line.matchAll(/(10\.[\.\d]+\/[^\s\}]+)/ig);

  list.push( ... new Set([
    ... Array.from(urlMatches).map(match => match[1].toLowerCase()),
    ... Array.from(doiMatches).map(match => match[1].toLowerCase())
  ]));

  return list;
}

// Rudimentary rate limiting (keeps ~ 20 requests / second).
//

function schedule50ms (callback) {
  return window
    .setTimeout(callback, 50);
}

