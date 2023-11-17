import http from 'k6/http';
import { check } from 'k6';

export let options = {
    vus: 1,
    duration: '60s',
};



const query = {
    query: `{
        artist {
          ArtistId
          Name
          Albums {
            AlbumId
            Title
            Tracks {
              TrackId
              Name
            }
          }
        }
      }
      `
};

// const query = {
//     query: `{
//         albumByAlbumid(AlbumId: 1) {
//           AlbumId
//           Title
//         }
//       }`
// };

export default function () {
    const headers = { 'Content-Type': 'application/json' };
    const response = http.post('http://localhost:8000/graphql', JSON.stringify(query), { headers });
    
    check(response, {
        'is status 200': (r) => r.status === 200,
        'is response ok': (r) => JSON.parse(r.body).data != null,
    });

    // sleep(1);
};
