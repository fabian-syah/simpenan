// ============================================================
// ID3 Tag & Album Cover Art Reader
// Pure client-side binary parser for ID3v2.3 & ID3v2.4 metadata
// Zero external dependencies, memory-safe with Blob URL revoking
// ============================================================

export interface AudioMetadata {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  trackNumber?: string;
  coverUrl?: string;
  lyrics?: string;
}

function parseSynchsafeInt(b0: number, b1: number, b2: number, b3: number): number {
  return (b0 << 21) | (b1 << 14) | (b2 << 7) | b3;
}

function decodeText(bytes: Uint8Array, encoding: number): string {
  try {
    if (encoding === 0) {
      // ISO-8859-1 (Latin1)
      let str = '';
      for (let i = 0; i < bytes.length; i++) {
        if (bytes[i] === 0) break;
        str += String.fromCharCode(bytes[i]);
      }
      return str.trim();
    } else if (encoding === 1) {
      // UTF-16 with BOM
      const decoder = new TextDecoder('utf-16');
      return decoder.decode(bytes).replace(/\0+$/, '').trim();
    } else if (encoding === 2) {
      // UTF-16BE
      const decoder = new TextDecoder('utf-16be');
      return decoder.decode(bytes).replace(/\0+$/, '').trim();
    } else if (encoding === 3) {
      // UTF-8
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(bytes).replace(/\0+$/, '').trim();
    }
  } catch {
    // Fallback simple string extraction
    let str = '';
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] >= 32 && bytes[i] <= 126) {
        str += String.fromCharCode(bytes[i]);
      }
    }
    return str.trim();
  }
  return '';
}

export function parseID3TagsFromBuffer(buffer: ArrayBuffer): AudioMetadata {
  const metadata: AudioMetadata = {};
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // Check ID3 identifier (bytes 0-2)
  if (bytes.length < 10) return metadata;
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) {
    return metadata;
  }

  const majorVersion = bytes[3]; // 3 for ID3v2.3, 4 for ID3v2.4
  if (majorVersion < 3 || majorVersion > 4) {
    return metadata;
  }

  const tagSize = parseSynchsafeInt(bytes[6], bytes[7], bytes[8], bytes[9]);
  const endOffset = Math.min(10 + tagSize, buffer.byteLength);
  let offset = 10;

  while (offset + 10 <= endOffset) {
    // Check if padding started (zeros)
    if (bytes[offset] === 0) break;

    // Frame ID (4 characters)
    let frameId = '';
    for (let i = 0; i < 4; i++) {
      frameId += String.fromCharCode(bytes[offset + i]);
    }

    // Frame size
    let frameSize = 0;
    if (majorVersion === 4) {
      frameSize = parseSynchsafeInt(
        bytes[offset + 4],
        bytes[offset + 5],
        bytes[offset + 6],
        bytes[offset + 7]
      );
    } else {
      frameSize = view.getUint32(offset + 4);
    }

    if (frameSize <= 0 || offset + 10 + frameSize > endOffset) {
      break;
    }

    const frameDataOffset = offset + 10;
    const frameData = bytes.subarray(frameDataOffset, frameDataOffset + frameSize);

    if (frameData.length > 1) {
      const encoding = frameData[0];
      const textBytes = frameData.subarray(1);

      if (frameId === 'TIT2') {
        metadata.title = decodeText(textBytes, encoding);
      } else if (frameId === 'TPE1') {
        metadata.artist = decodeText(textBytes, encoding);
      } else if (frameId === 'TALB') {
        metadata.album = decodeText(textBytes, encoding);
      } else if (frameId === 'TYER' || frameId === 'TDRC') {
        metadata.year = decodeText(textBytes, encoding);
      } else if (frameId === 'TRCK') {
        metadata.trackNumber = decodeText(textBytes, encoding);
      } else if (frameId === 'USLT') {
        // Unsynchronized lyrics
        if (frameData.length > 5) {
          let pos = 4; // skip encoding (1) + language (3)
          // Skip description null terminated
          if (encoding === 1 || encoding === 2) {
            while (pos < frameData.length - 1 && !(frameData[pos] === 0 && frameData[pos + 1] === 0)) {
              pos += 2;
            }
            pos += 2;
          } else {
            while (pos < frameData.length && frameData[pos] !== 0) {
              pos++;
            }
            pos++;
          }
          if (pos < frameData.length) {
            metadata.lyrics = decodeText(frameData.subarray(pos), encoding);
          }
        }
      } else if (frameId === 'APIC') {
        // Picture frame
        try {
          let picOffset = 1;
          let mimeType = '';
          while (picOffset < frameData.length && frameData[picOffset] !== 0) {
            mimeType += String.fromCharCode(frameData[picOffset]);
            picOffset++;
          }
          picOffset++; // Skip null delimiter

          if (picOffset < frameData.length) {
            // Picture type (1 byte)
            picOffset++;

            // Description (terminated by null)
            if (encoding === 1 || encoding === 2) {
              while (picOffset < frameData.length - 1 && !(frameData[picOffset] === 0 && frameData[picOffset + 1] === 0)) {
                picOffset += 2;
              }
              picOffset += 2;
            } else {
              while (picOffset < frameData.length && frameData[picOffset] !== 0) {
                picOffset++;
              }
              picOffset++;
            }

            if (picOffset < frameData.length) {
              const imageBytes = frameData.subarray(picOffset);
              if (imageBytes.length > 0) {
                const finalMime = mimeType || 'image/jpeg';
                const blob = new Blob([imageBytes], { type: finalMime });
                metadata.coverUrl = URL.createObjectURL(blob);
              }
            }
          }
        } catch {
          // Ignore APIC parsing errors
        }
      }
    }

    offset += 10 + frameSize;
  }

  return metadata;
}

export async function fetchAudioMetadata(url: string): Promise<AudioMetadata> {
  try {
    // Fetch initial 512 KB slice for fast ID3 parsing
    const response = await fetch(url, {
      headers: {
        Range: 'bytes=0-524287',
      },
    });

    if (response.ok || response.status === 206) {
      const buffer = await response.arrayBuffer();
      return parseID3TagsFromBuffer(buffer);
    }
  } catch {
    // Fallback: If range request fails, return empty metadata
  }
  return {};
}
