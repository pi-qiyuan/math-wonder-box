class TaboowRandomizer {
    constructor(arrayLength, memorySize = 3) {
        this.length = arrayLength;
        this.memorySize = Math.min(memorySize, arrayLength - 1); 
        this.history = [];
    }

    next() {
        let index;
        do {
            index = Math.floor(Math.random() * this.length);
        } while (this.history.includes(index));

        this.history.push(index);
        if (this.history.length > this.memorySize) {
            this.history.shift();
        }
        return index;
    }
}
