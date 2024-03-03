export const expected = {
  "data": {
    "artist": [
      {
        "ArtistId": 1,
        "Name": "AC/DC",
        "Albums": [
          {
            "AlbumId": 4,
            "Title": "Let There Be Rock",
            "Tracks": [
              {
                "TrackId": 22,
                "Name": "Whole Lotta Rosie"
              },
              {
                "TrackId": 21,
                "Name": "Hell Ain't A Bad Place To Be"
              },
              {
                "TrackId": 20,
                "Name": "Overdose"
              },
              {
                "TrackId": 19,
                "Name": "Problem Child"
              },
              {
                "TrackId": 18,
                "Name": "Bad Boy Boogie"
              }
            ]
          }
        ]
      },
      {
        "ArtistId": 2,
        "Name": "Accept",
        "Albums": [
          {
            "AlbumId": 2,
            "Title": "Balls to the Wall",
            "Tracks": [
              {
                "TrackId": 2,
                "Name": "Balls to the Wall"
              }
            ]
          },
          {
            "AlbumId": 3,
            "Title": "Restless and Wild",
            "Tracks": [
              {
                "TrackId": 5,
                "Name": "Princess of the Dawn"
              },
              {
                "TrackId": 4,
                "Name": "Restless and Wild"
              },
              {
                "TrackId": 3,
                "Name": "Fast As a Shark"
              }
            ]
          }
        ]
      },
      {
        "ArtistId": 3,
        "Name": "Aerosmith",
        "Albums": [
          {
            "AlbumId": 5,
            "Title": "Big Ones",
            "Tracks": [
              {
                "TrackId": 37,
                "Name": "Livin' On The Edge"
              },
              {
                "TrackId": 36,
                "Name": "Angel"
              },
              {
                "TrackId": 35,
                "Name": "Eat The Rich"
              },
              {
                "TrackId": 34,
                "Name": "Crazy"
              },
              {
                "TrackId": 33,
                "Name": "The Other Side"
              }
            ]
          }
        ]
      },
      {
        "ArtistId": 4,
        "Name": "Alanis Morissette",
        "Albums": [
          {
            "AlbumId": 6,
            "Title": "Jagged Little Pill",
            "Tracks": [
              {
                "TrackId": 50,
                "Name": "You Oughta Know (Alternate)"
              },
              {
                "TrackId": 49,
                "Name": "Wake Up"
              },
              {
                "TrackId": 48,
                "Name": "Not The Doctor"
              },
              {
                "TrackId": 47,
                "Name": "Ironic"
              },
              {
                "TrackId": 46,
                "Name": "Mary Jane"
              }
            ]
          }
        ]
      },
      {
        "ArtistId": 5,
        "Name": "Alice In Chains",
        "Albums": [
          {
            "AlbumId": 7,
            "Title": "Facelift",
            "Tracks": [
              {
                "TrackId": 62,
                "Name": "Real Thing"
              },
              {
                "TrackId": 61,
                "Name": "I Know Somethin (Bout You)"
              },
              {
                "TrackId": 60,
                "Name": "Confusion"
              },
              {
                "TrackId": 59,
                "Name": "Put You Down"
              },
              {
                "TrackId": 58,
                "Name": "Sunshine"
              }
            ]
          }
        ]
      }
    ]
  }
};

export const query = {
    query: `{
        artist(limit: 5) {
          ArtistId
          Name
          Albums(limit: 5, where: {AlbumId: {_gt: 1}}) {
            AlbumId
            Title
            Tracks(limit: 5, order_by: [{TrackId: Desc}]) {
              TrackId
              Name
            }
          }
        }
      }
      `
};