/** Pull exact byte counts out of a chunk stream (used by the tar reader). */
export class ByteReader {
    it;
    buffered = [];
    bufferedLength = 0;
    done = false;
    constructor(source) {
        this.it = source[Symbol.asyncIterator]();
    }
    async fill() {
        if (this.done)
            return false;
        const step = await this.it.next();
        if (step.done) {
            this.done = true;
            return false;
        }
        if (step.value.length > 0) {
            this.buffered.push(step.value);
            this.bufferedLength += step.value.length;
        }
        return true;
    }
    /** Read exactly `n` bytes; returns fewer only at EOF. */
    async read(n) {
        while (this.bufferedLength < n && (await this.fill()))
            ;
        const out = new Uint8Array(Math.min(n, this.bufferedLength));
        let off = 0;
        while (off < out.length) {
            const head = this.buffered[0];
            const take = Math.min(head.length, out.length - off);
            out.set(head.subarray(0, take), off);
            off += take;
            if (take === head.length)
                this.buffered.shift();
            else
                this.buffered[0] = head.subarray(take);
            this.bufferedLength -= take;
        }
        return out;
    }
    /** Yield exactly `n` bytes as chunks. Throws on premature EOF. */
    async *stream(n) {
        let remaining = n;
        while (remaining > 0) {
            if (this.bufferedLength === 0 && !(await this.fill()))
                throw new Error('unexpected end of archive');
            const head = this.buffered[0];
            const take = Math.min(head.length, remaining);
            const chunk = head.subarray(0, take);
            if (take === head.length)
                this.buffered.shift();
            else
                this.buffered[0] = head.subarray(take);
            this.bufferedLength -= take;
            remaining -= take;
            yield chunk;
        }
    }
    async skip(n) {
        for await (const _ of this.stream(n)) {
            /* discard */
        }
    }
}
