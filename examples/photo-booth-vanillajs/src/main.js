import './index.css'
import { html, render } from 'lighterhtml'
import localforage from 'localforage'
import { proxy, snapshot, subscribe } from 'valtio/vanilla'

localforage.config({ name: 'valtio_photo_booth' })

const getId = () => new Date().getTime()

window.history.pushState({}, '', '/photo-booth')

// reference https://github.com/webrtc/samples/blob/gh-pages/src/content/getusermedia/canvas/js/main.js
const canvas = document.querySelector('canvas')
canvas.width = 480
canvas.height = 360
const ctx = canvas.getContext('2d')
const video = document.querySelector('video')
const imageContainer = document.getElementById('images')
const snapPicButton = document.getElementById('take-pic-btn')
const acceptPicButton = document.getElementById('accept-pic-btn')
const rejectPicButton = document.getElementById('reject-pic-btn')
const candidateImgControlsContainer = document.getElementById(
  'candidate-img-controls'
)

const store = proxy({
  camera: {
    images: [],
    candidateImage: null,
  },
  ui: {
    selectedImageId:
      decodeURI(window.location.pathname).split('/photo-booth/')[1] || null,
  },
})

subscribe(store, () => {
  // keep storage synced
  localforage.setItem('images', snapshot(store).camera.images || [])
  // hide canvas when not used
  if (store.camera.candidateImage) {
    canvas.removeAttribute('hidden')
  } else {
    canvas.setAttribute('hidden', 'hidden')
  }
  // render html
  renderCanvasControls(!!store.camera.candidateImage)
  renderImages(store.camera.images, store.ui.selectedImageId)
})

/******** PERSISTED IMAGES HANDLING *********/

async function loadImages() {
  const images = await localforage.getItem('images')
  if (images) store.camera.images = images
}

function removeImage(id) {
  store.camera.images = store.camera.images.filter((img) => img.id !== id)
}

function selectImage(id) {
  const selectedId = store.ui.selectedImageId
  if (selectedId === id) {
    store.ui.selectedImageId = null
    window.history.pushState({}, '', '/photo-booth/')
  } else {
    store.ui.selectedImageId = id
    window.history.pushState({}, '', '/photo-booth/' + id)
  }
}

function saveImage(url) {
  const id = getId()
  store.camera.images.push({ id, url })
  window.history.pushState({}, '', id)
}

function renderImages(images, selectedId) {
  render(
    imageContainer,
    html.node`
    ${images.map(({ url, id }) => {
      const selected = id === selectedId
      return html.node`
      <a href="${url}" class=${
        selected ? 'selected animate-in' : ''
      } onclick=${(e) => {
        e.preventDefault()
        selectImage(id)
      }}>
        <img src=${url} class=${selected ? 'selected animate-in' : ''}>
        <button class=${
          selected ? 'image-remove-btn selected' : 'image-remove-btn'
        } onclick=${() => removeImage(id)}>X</button>
      </a>
    `
    })}
  `
  )
}

/******** CANDIDATE IMAGE HANDLING *********/

function keepCandidateImage(e) {
  e.preventDefault()
  saveImage(store.camera.candidateImage)
  store.camera.candidateImage = null
}

function removeCandidateImage(e) {
  e.preventDefault()
  store.camera.candidateImage = null
}

function renderCanvasControls(hasCandidateImage) {
  const className = !hasCandidateImage ? 'hidden' : ''
  render(
    candidateImgControlsContainer,
    html.node`
      <button id="accept-pic-btn" class=${className} onclick=${keepCandidateImage}>
        Keep picture</button>
      <button id="reject-pic-btn" class=${className} onclick=${removeCandidateImage}>Reject picture</button>
    `
  )
}

/******** MEDIA STREAM INIT *********/

async function startMediaStream() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    })
    video.srcObject = stream
  } catch (err) {
    // should show user an error message
    console.log('failed to create stream', err)
  }
}

/******** SETUP *********/

window.addEventListener('load', async () => {
  await loadImages()
  await startMediaStream()

  snapPicButton.addEventListener('click', () => {
    const width = video.videoWidth
    const height = video.videoHeight
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(video, 0, 0, width, height)
    store.camera.candidateImage = canvas.toDataURL('image/webp')
  })

  acceptPicButton.addEventListener('click', () => {
    saveImage(store.camera.candidateImage)
    store.camera.candidateImage = null
  })

  rejectPicButton.addEventListener('click', () => {
    store.camera.candidateImage = null
  })
})
