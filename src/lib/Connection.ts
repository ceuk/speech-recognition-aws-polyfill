/**
 * Conection singleton
 */
class Connection {
  private static url: string
  private static instance?: WebSocket

  private constructor() {}

  public static getInstance() {
    if ((!Connection.instance || !Connection.isActive()) && Connection.url) {
      Connection.instance = new WebSocket(Connection.url);
      Connection.instance.binaryType = 'arraybuffer'
    }

    return Connection.instance;
  }

  public static isActive() {
    return !!(Connection.instance?.readyState === WebSocket.OPEN)
  }


  public static setUrl(url: string) {
    if (Connection.url !== url) {
      Connection.instance = new WebSocket(url);
      Connection.instance.binaryType = 'arraybuffer'
    }
    Connection.url = url
  }

  public static close() {
    if (Connection.isActive()) {
      Connection.instance?.close()
    }
    Connection.instance = undefined;
  }
}

export default Connection
