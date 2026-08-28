# Findwhy Browser Support

## Official supported baseline

- Safari / iOS / iPadOS 16.2+
- Chrome 100+
- Edge 100+
- Firefox 100+
- Android Chrome / Chromium WebView 100+
- iOS WeChat WebView on iOS 16.2+
- Android WeChat WebView with Chromium 100+

## Hard minimum

- Safari / iOS 15.4
- Chrome / Edge 90
- Firefox 98
- Chromium WebView 90

The hard minimum only indicates that core functionality may work in theory. These versions are not officially maintained or included in routine regression testing.

## Unsupported

- Internet Explorer
- Safari 15.3 and earlier
- Opera Mini
- Old Android Browser
- Chromium / WebView earlier than 90

## Required regression checks

Run browser compatibility regression checks after:

- Astro, Vite, or Lightning CSS upgrades
- Gallery or Lightbox changes
- Animation interaction changes
- Adding CSS features or media formats

Test at least Safari / iOS 16.2, current Chrome, Edge, and Firefox, a representative Android Chrome / WebView device, and iOS and Android WeChat WebViews.

The regression must cover:

- Responsive layouts at 430, 768, 1024, 1440, and 1920 pixels
- Horizontal overflow
- Illustration, Animation, Series, Projects, and About
- Lightbox open, close, and image switching
- Mobile video tap and desktop hover playback
- Direct Blob images and videos, including HTTP 206 Range responses
- Production-build CSS syntax against the supported baseline
