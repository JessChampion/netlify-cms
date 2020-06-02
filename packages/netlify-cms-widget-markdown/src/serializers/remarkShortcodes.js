export function remarkParseShortcodes({ plugins }) {
  const Parser = this.Parser;
  const tokenizers = Parser.prototype.blockTokenizers;
  const methods = Parser.prototype.blockMethods;

  tokenizers.shortcode = createShortcodeTokenizer({ plugins });

  methods.unshift('shortcode');
}

function createShortcodeTokenizer({ plugins }) {
  return function tokenizeShortcode(eat, value, silent) {
    const initialValue = value;
    const matches = [];
    plugins.forEach((plugin) => {
      const potentialMatchValue = initialValue.split('\n\n')[0].trimEnd();
      let match;
      if (typeof plugin.pattern === 'function') {
        match = plugin.pattern(initialValue);
        if (!match) {
          match = plugin.pattern(potentialMatchValue);
        }
      } else { //assume regex
        match = initialValue.match(plugin.pattern);

        if (!match) {
          match = potentialMatchValue.match(plugin.pattern);
        }
      }
      if (match) {
        matches.push({
          match,
          plugin
        });
      }
    });
    if (matches.length > 0) {
      matches.forEach(({ match, plugin }) => {
        if (match) {
          if (silent) {
            return true;
          }

          const shortcodeData = plugin.fromBlock(match);

          try {
            return eat(match[0])({
              type: 'shortcode',
              data: {
                shortcode: plugin.id,
                shortcodeData
              }
            });
          } catch (e) {
            if (e.message.startsWith('Incorrectly eaten value: ')) {
              return false; //ignore this message as our changes mean we 'want' to eat it incorrectly
            }
            console.warn(
              `Sent invalid data to remark. Plugin: ${plugin.id}. Value: ${
                match[0]
              }. Data: ${JSON.stringify(shortcodeData)}`
            );
            return false;
          }
        }
      });
    }
  };
}

export function createRemarkShortcodeStringifier({ plugins }) {
  return function remarkStringifyShortcodes() {
    const Compiler = this.Compiler;
    const visitors = Compiler.prototype.visitors;

    visitors.shortcode = shortcode;

    function shortcode(node) {
      const { data } = node;
      const plugin = plugins.find(plugin => data.shortcode === plugin.id);
      return plugin.toBlock(data.shortcodeData);
    }
  };
}
