#include "DocumentObject.h"

int main() {
    DocumentObject object;
    object.recompute();
    return object.mustExecute() ? 0 : 1;
}
