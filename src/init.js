import { string, setLocale } from 'yup';
import i18next from 'i18next';
import axios from 'axios';
import initializeWatcher from './view';
import parseXML from './parser';
import checkUpdates from './updater';
import resources from './locales/index';

const proxyUrl = 'https://allorigins.hexlet.app/get?disableCache=true&url=';
const defaultLng = 'ru';

export default () => {
  const i18nextInstance = i18next.createInstance();
  i18nextInstance.init({
    lng: defaultLng,
    debug: false,
    resources,

  }).then(() => {
    const elements = {
      form: document.querySelector('form'),
      input: document.querySelector('#url-input'),
      feedback: document.querySelector('.feedback'),
      button: document.querySelector('form button[type="submit"]'),
      feeds: document.querySelector('[content-id="feeds"]'),
      posts: document.querySelector('[content-id="posts"]'),
      modal: {
        title: document.querySelector('.modal-title'),
        body: document.querySelector('.modal-body'),
        button: document.querySelector('.full-article'),
        closeButton: document.querySelector('.modal-footer > button.btn-secondary'),
      },
      header: document.querySelector('h1'),
      lead: document.querySelector('p.lead'),
      example: document.querySelector('.example'),
      inputLabel: document.querySelector('label'),
    };

    const stateInit = {
      form: {
        state: 'filling',
        errors: [],
      },
      feeds: [],
      posts: [],
      ui: {
        readPostsIds: new Set(),
      },
    };

    const state = initializeWatcher(stateInit, elements, i18nextInstance);

    setLocale({
      mixed: {
        notOneOf: i18nextInstance.t('duplicate'),
      },
      string: {
        url: i18nextInstance.t('invalidUrl'),
      },
    });

    const validateURL = (str) => {
      const urlSchema = string()
        .required()
        .url()
        .notOneOf(state.feeds.map((feed) => feed.url));

      urlSchema.validate(str)
        .then(() => {
          state.form.errors = [];
          state.form.state = 'downloading';
          return str;
        })
        .then((url) => axios.get(`${proxyUrl}${encodeURIComponent(url)}`))
        .then((res) => {
          state.form.state = 'download successful';
          return parseXML(res.data.contents);
        })
        .then(([feed, items]) => {
          state.feeds.unshift({ ...feed, url: str });
          state.posts.unshift(...items);
          return Promise.resolve();
        })
        .then(() => {
          checkUpdates(str, 5000, state);
        })
        .catch((e) => {
          if (e.message === 'Network Error') {
            state.form.state = 'download error';
          }
          if (e.message === 'invalidRss') {
            state.form.state = 'invalid rss';
          }
          state.form.errors = e.errors;
          state.form.state = 'invalid';
        });
    };

    elements.button.textContent = i18nextInstance.t('addButton');
    elements.modal.button.textContent = i18nextInstance.t('readMoreButton');
    elements.modal.closeButton.textContent = i18nextInstance.t('closeButton');
    elements.header.textContent = i18nextInstance.t('header');
    elements.lead.textContent = i18nextInstance.t('lead');
    elements.example.textContent = i18nextInstance.t('example');
    elements.inputLabel.textContent = i18nextInstance.t('inputPlaceholder');

    elements.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const userInput = formData.get('url');
      validateURL(userInput);
    });
  });
};
