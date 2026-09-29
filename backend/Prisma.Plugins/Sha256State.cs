using System;
using System.Globalization;
using System.Text;

namespace Prisma.Plugins
{
    // SHA-256 whose intermediate state survives between Custom API calls, so each upload block is hashed once as it arrives.
    public sealed class Sha256State
    {
        private static readonly uint[] K = {
            0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
            0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
            0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
            0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
            0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
            0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
            0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
            0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
        };

        private readonly uint[] hash;
        private long length;

        private Sha256State(uint[] hash, long length) { this.hash = hash; this.length = length; }

        public static Sha256State Start()
        {
            return new Sha256State(new uint[] { 0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19 }, 0);
        }

        public long Length { get { return length; } }

        public static Sha256State Parse(string value)
        {
            var parts = (value ?? "").Split(':');
            long length;
            if (parts.Length != 2 || !System.Text.RegularExpressions.Regex.IsMatch(parts[0], "\\A[0-9a-f]{64}\\z")
                || !long.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out length) || length % 64 != 0)
                throw MediaPolicy.Invalid("Invalid upload integrity state. Remove and restart the upload.");
            var hash = new uint[8];
            for (var index = 0; index < 8; index++) hash[index] = uint.Parse(parts[0].Substring(index * 8, 8), NumberStyles.AllowHexSpecifier, CultureInfo.InvariantCulture);
            return new Sha256State(hash, length);
        }

        public string Serialize()
        {
            var text = new StringBuilder(80);
            foreach (var word in hash) text.Append(word.ToString("x8", CultureInfo.InvariantCulture));
            return text.Append(':').Append(length.ToString(CultureInfo.InvariantCulture)).ToString();
        }

        public void Append(byte[] data)
        {
            if (data == null || data.Length % 64 != 0) throw MediaPolicy.Invalid("Intermediate upload blocks must align to 64 bytes.");
            for (var offset = 0; offset < data.Length; offset += 64) Compress(data, offset);
            length += data.Length;
        }

        public string Finish(byte[] last)
        {
            if (last == null) throw MediaPolicy.Invalid("Missing final upload block.");
            var total = length + last.Length;
            var padded = new byte[(last.Length + 9 + 63) / 64 * 64];
            Buffer.BlockCopy(last, 0, padded, 0, last.Length);
            padded[last.Length] = 0x80;
            var bits = (ulong)total * 8;
            for (var index = 0; index < 8; index++) padded[padded.Length - 1 - index] = (byte)(bits >> (8 * index));
            for (var offset = 0; offset < padded.Length; offset += 64) Compress(padded, offset);
            length = total;
            var text = new StringBuilder(64);
            foreach (var word in hash) text.Append(word.ToString("x8", CultureInfo.InvariantCulture));
            return text.ToString();
        }

        private void Compress(byte[] data, int offset)
        {
            var w = new uint[64];
            for (var index = 0; index < 16; index++)
                w[index] = (uint)(data[offset + index * 4] << 24 | data[offset + index * 4 + 1] << 16 | data[offset + index * 4 + 2] << 8 | data[offset + index * 4 + 3]);
            for (var index = 16; index < 64; index++)
            {
                var s0 = Rotate(w[index - 15], 7) ^ Rotate(w[index - 15], 18) ^ (w[index - 15] >> 3);
                var s1 = Rotate(w[index - 2], 17) ^ Rotate(w[index - 2], 19) ^ (w[index - 2] >> 10);
                w[index] = unchecked(w[index - 16] + s0 + w[index - 7] + s1);
            }
            uint a = hash[0], b = hash[1], c = hash[2], d = hash[3], e = hash[4], f = hash[5], g = hash[6], h = hash[7];
            for (var index = 0; index < 64; index++)
            {
                var t1 = unchecked(h + (Rotate(e, 6) ^ Rotate(e, 11) ^ Rotate(e, 25)) + ((e & f) ^ (~e & g)) + K[index] + w[index]);
                var t2 = unchecked((Rotate(a, 2) ^ Rotate(a, 13) ^ Rotate(a, 22)) + ((a & b) ^ (a & c) ^ (b & c)));
                h = g; g = f; f = e; e = unchecked(d + t1); d = c; c = b; b = a; a = unchecked(t1 + t2);
            }
            unchecked { hash[0] += a; hash[1] += b; hash[2] += c; hash[3] += d; hash[4] += e; hash[5] += f; hash[6] += g; hash[7] += h; }
        }

        private static uint Rotate(uint value, int bits) { return (value >> bits) | (value << (32 - bits)); }
    }
}
