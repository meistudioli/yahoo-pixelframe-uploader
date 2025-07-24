import { _wcl } from './common-lib.js';
import { _wccss } from './common-css.js';

import './aws-sdk-2.633.0.min.js';

/*
 reference:
 - Object.groupBy(): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/groupBy
 - canvas: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage
 */

const defaults = {
  multiple: false,
  accept: '.jpg,.jpeg,.png,.gif,.webp,.avif,.mov,.mp4,.ogg,.webm',
  imagelimitation: {
    minwidth: 100,
    minheight: 100,
    size: 1024 * 1024 * 50
  },
  videolimitation: {
    minwidth: 100,
    minheight: 100,
    size: 1024 * 1024 * 300,
    duration: 60 * 60
  },
  maximagecount: 5,
  maxvideocount: 5,
  webservice: {
    token: {
      url: 'https://trendr-apac.media.yahoo.com/api/pixelframe/v1/aws/resources/s3/credentials?role=content-upload'
    },
    upload: {
      urls: {
        video: 'https://trendr-apac.media.yahoo.com/api/pixelframe/v1/videos/upload',
        image: 'https://trendr-apac.media.yahoo.com/api/pixelframe/v1/images/upload'
      },
      params: {
        targetType: 'rating',
        targetId: 'auction2',
        appName: 'auction',
        resizingProfile: 'bid_seller_logo',
        transcodingProfile: 'auction'
      }
    }
  },
};

const booleanAttrs = ['multiple']; // booleanAttrs default should be false
const objectAttrs = ['imagelimitation', 'videolimitation', 'webservice'];
const custumEvents = {
  pick: 'yahoo-pixelframe-uploader-pick',
  error: 'yahoo-pixelframe-uploader-error',
  processStart: 'yahoo-pixelframe-uploader-process-start',
  processEnd: 'yahoo-pixelframe-uploader-process-end',
  progress: 'yahoo-pixelframe-uploader-progress',
  done: 'yahoo-pixelframe-uploader-done'
};
const isMobile = !window.matchMedia('(hover: hover)').matches;

const template = document.createElement('template');
template.innerHTML = `
<style>
${_wccss}

:host{position:relative;display:block;}

.main {
  inline-size: fit-content;
  block-size: fit-content;

  .uploader-trigger {
    position: relative;
    inline-size: fit-content;
    block-size: fit-content;
    overflow: hidden;
    display: block;

    &>input[type="file"] {
      position: absolute;
      inset-block-start: -100%;
    }
  }
}
</style>

<div class="main" ontouchstart="">
  <label class="uploader-trigger">
    <input class="uploader-trigger__input" type="file" />
    <slot name="trigger"></slot>
  </label>
</div>
`;

export class YahooPixelframeUploader extends HTMLElement {
  #data;
  #nodes;
  #config;

  constructor(config) {
    super();

    // template
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    // data
    this.#data = {
      controller: '',
      units: {},
      order: [],
      processing: false
    };

    // nodes
    this.#nodes = {
      styleSheet: this.shadowRoot.querySelector('style'),
      input: this.shadowRoot.querySelector('.uploader-trigger__input'),
    };

    // config
    this.#config = {
      ...defaults,
      ...config // new YahooPixelframeUploader(config)
    };

    // evts
    this._onFilesChange = this._onFilesChange.bind(this);
  }

  async connectedCallback() {
   const { config, error } = await _wcl.getWCConfig(this);
   const { input } = this.#nodes;

    if (error) {
      console.warn(`${_wcl.classToTagName(this.constructor.name)}: ${error}`);
      this.remove();
      return;
    } else {
      this.#config = {
        ...this.#config,
        ...config
      };
    }

    // upgradeProperty
    Object.keys(defaults).forEach((key) => this.#upgradeProperty(key));

    // evts
    this.#data.controller = new AbortController();
    const signal = this.#data.controller.signal;
    input.addEventListener('change', this._onFilesChange, { signal });
  }

  disconnectedCallback() {
    if (this.#data?.controller) {
      this.#data.controller.abort();
    }
  }

  #format(attrName, oldValue, newValue) {
    const hasValue = newValue !== null;

    if (!hasValue) {
      if (booleanAttrs.includes(attrName)) {
        this.#config[attrName] = false;
      } else {
        this.#config[attrName] = defaults[attrName];
      }
    } else {
      switch (attrName) {
        case 'webservice': {
          let values;
          try {
            values = JSON.parse(newValue);
          } catch(err) {
            console.warn(`${_wcl.classToTagName(this.constructor.name)}: ${err.message}`);
            values = Array.isArray(defaults[attrName]) ? [ ...defaults[attrName] ] : { ...defaults[attrName] };
          }

          this.#config[attrName] = values;
          break;
        }

        case 'imagelimitation':
        case 'videolimitation': {
          let values;
          try {
            values = JSON.parse(newValue);
          } catch(err) {
            console.warn(`${_wcl.classToTagName(this.constructor.name)}: ${err.message}`);
            values = Array.isArray(defaults[attrName]) ? [ ...defaults[attrName] ] : { ...defaults[attrName] };
          }

          this.#config[attrName] = {
            ...defaults[attrName],
            ...values
          };
          break;
        }

        case 'maximagecount':
        case 'maxvideocount': {
          const num = +newValue;
          this.#config[attrName] = (isNaN(num) || num < 0) ? defaults[attrName] : num;
          break;
        }

        case 'accept': {
          this.#config[attrName] = newValue.length > 0 ? newValue : defaults[attrName];
          break;
        }
      }
    }
  }

  attributeChangedCallback(attrName, oldValue, newValue) {
    if (!YahooPixelframeUploader.observedAttributes.includes(attrName)) {
      return;
    }

    const { input } = this.#nodes;

    this.#format(attrName, oldValue, newValue);

    switch (attrName) {
      case 'multiple': {
        input.toggleAttribute('multiple', this.multiple);
        break;
      }

      case 'accept': {
        input.setAttribute('accept', this.accept);
        break;
      }
    }
  }

  static get observedAttributes() {
    return Object.keys(defaults); // YahooPixelframeUploader.observedAttributes
  }

  static get supportedEvents() {
    return Object.keys(custumEvents).map(
      (key) => {
        return custumEvents[key];
      }
    );
  }

  #upgradeProperty(prop) {
    let value;

    if (YahooPixelframeUploader.observedAttributes.includes(prop)) {
      if (Object.prototype.hasOwnProperty.call(this, prop)) {
        value = this[prop];
        delete this[prop];
      } else {
        if (booleanAttrs.includes(prop)) {
          value = (this.hasAttribute(prop) || this.#config[prop]) ? true : false;
        } else if (objectAttrs.includes(prop)) {
          value = this.hasAttribute(prop) ? this.getAttribute(prop) : JSON.stringify(this.#config[prop]);
        } else {
          value = this.hasAttribute(prop) ? this.getAttribute(prop) : this.#config[prop];
        }
      }

      this[prop] = value;
    }
  }

  set imagelimitation(value) {
    if (value) {
      const newValue = {
        ...defaults.imagelimitation,
        ...this.imagelimitation,
        ...(typeof value === 'string' ? JSON.parse(value) : value)
      };
      this.setAttribute('imagelimitation', JSON.stringify(newValue));
    } else {
      this.removeAttribute('imagelimitation');
    }
  }

  get imagelimitation() {
    return this.#config.imagelimitation;
  }

  set videolimitation(value) {
    if (value) {
      const newValue = {
        ...defaults.videolimitation,
        ...this.videolimitation,
        ...(typeof value === 'string' ? JSON.parse(value) : value)
      };
      this.setAttribute('videolimitation', JSON.stringify(newValue));
    } else {
      this.removeAttribute('videolimitation');
    }
  }

  get videolimitation() {
    return this.#config.videolimitation;
  }

  set accept(value) {
    if (value) {
      this.setAttribute('accept', value);
    } else {
      this.removeAttribute('accept');
    }
  }

  get accept() {
    return this.#config.accept;
  }

  set webservice(value) {
    if (value) {
      const newValue = {
        ...defaults.webservice,
        ...this.webservice,
        ...(typeof value === 'string' ? JSON.parse(value) : value)
      };
      this.setAttribute('webservice', JSON.stringify(newValue));
    } else {
      this.removeAttribute('webservice');
    }
  }

  get webservice() {
    return this.#config.webservice;
  }

  set multiple(value) {
    this.toggleAttribute('multiple', Boolean(value));
  }

  get multiple() {
    return this.#config.multiple;
  }

  set maximagecount(value) {
    if (typeof value !== 'undefined') {
      this.setAttribute('maximagecount', value);
    } else {
      this.removeAttribute('maximagecount');
    }
  }

  get maximagecount() {
    return this.#config.maximagecount;
  }

  set maxvideocount(value) {
    if (typeof value !== 'undefined') {
      this.setAttribute('maxvideocount', value);
    } else {
      this.removeAttribute('maxvideocount');
    }
  }

  get maxvideocount() {
    return this.#config.maxvideocount;
  }

  get processing() {
    return this.#data.processing;
  }

  #fireEvent(evtName, detail) {
    this.dispatchEvent(new CustomEvent(evtName,
      {
        bubbles: true,
        composed: true,
        ...(detail && { detail })
      }
    ));
  }

  #getUnitId() {
    return `unit-${_wcl.getUUID()}`;
  }

  async #fetchFileInfo({ type, file }) {
    return new Promise(
      (resolve, reject) => {
        let host;

        if (type === 'image') {
          host = new Image();

          host.onload = async () => {
            const { naturalWidth:width, naturalHeight:height } = host;
            const thumbnail = await this.#getThumbnail({ type, width, height, dataURL:host.src });

            window.URL.revokeObjectURL(host.src);

            resolve({
              type,
              thumbnail,
              width,
              height
            });
          };
        } else {
          host = document.createElement('video');
          host.preload = 'metadata';

          host.onloadedmetadata = async () => {
            const { videoWidth:width, videoHeight:height, duration } = host;
            const thumbnail = await this.#getThumbnail({ type, width, height, dataURL:host.src });

            window.URL.revokeObjectURL(host.src);

            resolve({
              type,
              thumbnail,
              width,
              height,
              duration
            });
          };
        }

        host.onerror = () => {
          window.URL.revokeObjectURL(host.src);
          reject(new Error('fetch file info error.'));
        };

        host.src = window.URL.createObjectURL(file);
      }
    );
  }

  async #getThumbnail({ type, width, height, dataURL }) {
    return new Promise(
      (resolve, reject) => {
        const negative = type === 'image'
          ? new Image()
          : document.createElement('video');

        const size = 160;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        let sX, sY, sSize;

        canvas.width = size;
        canvas.height = size;

        if (width >= height) {
          sX = Math.floor((width - height) / 2);
          sY = 0;
          sSize = height;
        } else {
          sX = 0;
          sY = Math.floor((height - width) / 2);
          sSize = width;
        }

        negative.onerror = () => {
          reject(new Error('fetch file thumbnail error.'));
        };

        if (type === 'image') {
          negative.onload = () => {
            ctx.drawImage(negative, sX, sY, sSize, sSize, 0, 0, size, size);
            resolve(canvas.toDataURL('image/jpeg', 0.75));
          };

          negative.src = dataURL;
        } else {
          negative.onloadeddata = () => {
            // need to set buffer time
            const timer = /firefox/i.test(navigator.userAgent) ? 250 : 100;

            setTimeout(
              () => {
                ctx.drawImage(negative, sX, sY, sSize, sSize, 0, 0, size, size);
                resolve(canvas.toDataURL('image/jpeg', 0.75));
              }
            , timer);

          };

          negative.src = dataURL;
          negative.currentTime = 1;
        }
      }
    );
  }

  async #validation(file) {
    let response;

    const fileType = file.type
      .replace(/(.*)\/.*/, '$1')
      .toLowerCase();

    try {
      if (!['image', 'video'].includes(fileType)) {
        throw new Error(`file type not allowed.`);
      }

      const { type, thumbnail, width, height, duration } = await this.#fetchFileInfo({ type: fileType, file });
      const { minwidth, minheight, size, duration: maxduration } = (type === 'image') ? this.imagelimitation : this.videolimitation;

      // size
      if (file.size > size) {
        throw new Error(`file size must under ${size} bytes.`);
      }

      // width
      if (width < minwidth) {
        throw new Error(`file width must be bigger than ${minwidth}px.` );
      }

      // height
      if (height < minheight) {
        throw new Error(`file height must be bigger than ${minwidth}px.` );
      }

      // duration
      if (type === 'video' && duration > maxduration) {
        throw new Error(`file duration must be smaller than ${maxduration}s.` );
      }

      response = {
        type,
        file,
        thumbnail,
        id: this.#getUnitId(),
        ...(duration && { duration })
      };
    } catch(err) {
      console.warn(`${_wcl.classToTagName(this.constructor.name)}: ${err.message}`);
      this.#fireEvent(custumEvents.error, { message:err.message });

      response = {
        type: 'error',
        error: err.message
      };
    }

    return response;
  }

  async #uploadToS3({ id, file, credential }) {
    const { bucketName, credentials, path, region } = credential;
    const transientId = _wcl.getUUID();

    const s3 = new window.AWS.S3({
      apiVersion: '2006-03-01',
      region,
      params: {
        Bucket: bucketName
      },
      credentials
    });
    const params = {
      Key: `${path}/${transientId}`,
      Body: file
    };

    return new Promise((resolve, reject) => {
      s3.upload(params, (err, data) => {
        if (err) {
          reject(err);
          return;
        }

        if (data) {
          resolve(data);
        }
      })
      .on('httpUploadProgress',
        ({ loaded, total }) => {
          let progress = Math.floor((loaded / total) * 100);
          
          if (progress > 95) {
            progress = 95;
          }

          this.#setUnitProgress({ id, progress });
        }
      );
    });
  }

  #setUnitProgress({ id, progress }) {
    const data = this.#data.units[id];

    this.#data.units[id] = {
      ...data,
      progress
    };

    this.#fireEvent(custumEvents.progress, { id, progress });
  }

  async #upload({ id, type, file }) {
    const { token, upload } = this.webservice;

    try {
      // get token
      const { error:tokenErr, ...credential } = await fetch(token.url, {
        credentials: 'include',
        headers: {
          'content-type': 'application/json'
        },
        method: 'GET',
        mode: 'cors'
      }).then((response) => response.json());

      if (tokenErr) {
        throw new Error(tokenErr?.message || 'Network response was not ok.');
      }

      // upload file to S3
      const { Location } = await this.#uploadToS3({ id, file, credential });

      // fetch pixcelframe
      const { params = {}, urls } = upload;
      const { error:uploadErr, ...result } = await fetch(urls[type], {
        credentials: 'include',
        headers: {
          'content-type': 'application/json'
        },
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify({
          ...params,
          url: decodeURIComponent(Location)
        })
      }).then((response) => response.json());

      if (uploadErr) {
        throw new Error(uploadErr?.message || 'Network response was not ok.');
      }

      this.#setUnitProgress({ id, progress:100 });
      const data = this.#data.units[id];

      this.#data.units[id] = {
        ...data,
        result
      };
    } catch(err) {
      console.warn(`${_wcl.classToTagName(this.constructor.name)}: ${err.message}`);
      this.#setUnitProgress({ id, progress:100 });

      const data = this.#data.units[id];
      this.#data.units[id] = {
        ...data,
        error: err.message
      };

      this.#fireEvent(custumEvents.error, { id, message:err.message });
    }

    this.#detectDone();
  }

  #detectDone() {
    const flag = this.#data.order
      .some(
        (key) => {
          const { progress = 0 } = this.#data.units[key];
          return progress !== 100;
        }
      );

    if (!flag) {
      const results = this.#data.order.map(
        (key) => {
          const { result, error, type } = this.#data.units[key];

          return {
            id: key,
            type,
            ...(result && { result }),
            ...(error && { error })
          };
        }
      );

      this.#setProcessing('end');
      this.#fireEvent(custumEvents.done, { results });
    }
  }

  passFiles(files) {
    this._onFilesChange({
      target: { files }
    });
  }

  #setProcessing(status) {
    if (['start', 'end'].includes(status)) {
      this.#data.processing = status === 'start';
      this.#fireEvent(custumEvents[`process${_wcl.capitalize(status)}`]);
    }
  }

  async _onFilesChange(evt) {
    const { input } = this.#nodes;
    const {
      target: { files }
    } = evt;

    if (!files || !files.length) {
      input.value = '';
      return;
    }

    if (this.processing) {
      input.value = '';
      this.#fireEvent(custumEvents.error, { message: 'file(s) uploading, try later.' });
      return;
    }

    let results = [];

    if (isMobile) {
      for (const file of files) {
        const result = await this.#validation(file);

        results.push(result);
      }
    } else {
      results = await Promise.all(
        Array.from(files).map(
          (file) => {
            return this.#validation(file);
          }
        )
      );
    }

    input.value = '';

    const groups = Object?.groupBy(results, ({ type }) => type) || {};
    const { image = [], video = [] } = groups;
    const final = [].concat(video.slice(0, this.maxvideocount), image.slice(0, this.maximagecount));

    if (!final.length) {
      input.value = '';
      return;
    }

    // picked
    const picked = [];
    const order = [];

    final.forEach(
      (unit) => {
        const data = { ...unit };
        delete(data.file);

        picked.push(data);
        order.push(unit.id);
      }
    );

    this.#data.order = order;
    this.#data.units = picked.reduce(
      (acc, cur) => {
        const { id, ...others } = cur;

        acc[id] = {
          ...others,
          progress: 0
        };

        return acc;
      }
    , {});

    this.#fireEvent(custumEvents.pick, { picked });

    // upload
    this.#setProcessing('start');
    final.forEach(
      (unit) => {
        const { id, type, file } = unit;

        this.#upload({ id, type, file });
      }
    );

    input.value = '';
  }
}

// define web component
const S = _wcl.supports();
const T = _wcl.classToTagName('YahooPixelframeUploader');
if (S.customElements && S.shadowDOM && S.template && !window.customElements.get(T)) {
  window.customElements.define(_wcl.classToTagName('YahooPixelframeUploader'), YahooPixelframeUploader);
}